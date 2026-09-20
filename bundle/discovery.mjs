// Anna web tools only: no LLM, Agent session, automatic search, or catalog writes.
export const DISCOVERY_KEY = "ai-perk-radar:discovery-v1";
export const MAX_RESULTS = 6;
export const GROUPS = {
  ai: ["blog.google", "anthropic.com", "openai.com", "education.github.com", "github.blog", "ai.google.dev"],
  coding: ["education.github.com", "github.blog", "jetbrains.com", "appwrite.io", "mongodb.com", "vercel.com"],
  cloud: ["aws.amazon.com", "azure.microsoft.com", "cloud.google.com", "cloudflare.com", "mongodb.com", "digitalocean.com"],
  research: ["anthropic.com", "research.google", "aws.amazon.com", "azure.microsoft.com", "nvidia.com", "huggingface.co"],
};
const ALL_HOSTS = new Set(Object.values(GROUPS).flat());
const WINDOWS = new Set(["week", "month", "year", "any"]);
const string = (value, length) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f\ufffd]/g, "").slice(0, length) : "";

export function sourceUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048 || /[\s\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || !ALL_HOSTS.has(host)) return null;
    // Some vendor domains also host user content. Do not label those as official sources.
    if (host === "huggingface.co" && !/^\/(?:docs(?:\/|$)|pricing\/?$|blog\/[^/]+\/?$)/.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

export function searchSpec(profile, options = {}) {
  const topic = Object.hasOwn(GROUPS, options.topic) ? options.topic : "ai";
  const period = WINDOWS.has(options.period) ? options.period : "month";
  const roles = [profile?.student === true ? "student" : "", profile?.researcher === true ? "researcher" : "",
    profile?.developer === true ? "developer" : "", profile?.founder === true ? "startup" : ""].filter(Boolean);
  const subject = { ai: "AI subscriptions", coding: "developer tools", cloud: "cloud credits", research: "research computing AI" }[topic];
  const query = [roles.join(" "), subject, "official free offers benefits", profile?.country === "JP" ? "Japan" : "",
    profile?.limited_only === true ? "limited time" : ""].filter(Boolean).join(" ");
  const request = { query, max_results: MAX_RESULTS, search_depth: "basic", topic: "general", include_domains: [...GROUPS[topic]] };
  if (period !== "any") request.time_range = period;
  return { topic, period, query, request };
}

export function contextKey(profile, options) {
  // All matching controls invalidate displayed discovery, even if not sent to the provider.
  return JSON.stringify({ country: profile?.country, student: profile?.student, researcher: profile?.researcher,
    developer: profile?.developer, creator: profile?.creator, founder: profile?.founder, limited: profile?.limited_only,
    priority: profile?.priority, interests: [...(profile?.interests ?? [])].sort(), ...searchSpec(profile, options) });
}

export function cleanResults(reply, hosts) {
  if (!reply || !Array.isArray(reply.results)) throw new Error("invalid_response");
  const results = new Map();
  for (const item of reply.results.slice(0, 50)) {
    const url = sourceUrl(item?.url);
    if (!url || !hosts.includes(new URL(url).hostname.replace(/^www\./, ""))) continue;
    const title = string(item.title, 240).trim();
    if (!title || results.has(url)) continue;
    const published = typeof item.published_at === "string" && /^\d{4}-\d\d-\d\d(?:T.*)?$/.test(item.published_at)
      && Number.isFinite(Date.parse(item.published_at)) ? item.published_at.slice(0, 10) : null;
    results.set(url, { url, title, snippet: string(item.snippet, 700), published_at: published });
    if (results.size === MAX_RESULTS) break;
  }
  return [...results.values()];
}

export function cleanPage(reply, requestedUrl) {
  const page = reply?.pages?.[0];
  if (!page || page.ok !== true || sourceUrl(page.url) !== requestedUrl) throw new Error("page_failed");
  const finalUrl = sourceUrl(page.final_url ?? page.url);
  if (!finalUrl) throw new Error("unsafe_redirect");
  // A publisher redirect is acceptable only within the same allowlisted host.
  const host = value => new URL(value).hostname.replace(/^www\./, "");
  if (host(finalUrl) !== host(requestedUrl)) throw new Error("unsafe_redirect");
  const content = string(page.content, 6000).trim();
  if (!content || /(?:just a moment|verify you are human|captcha|access denied)/i.test(content.slice(0, 400))) throw new Error("page_failed");
  return { content, final_url: finalUrl, truncated: page.truncated === true || (typeof page.content === "string" && page.content.length > 6000) };
}

export function restoreDiscovery(value, key, now = Date.now()) {
  if (!value || value.schema !== 1 || value.context !== key || typeof value.query !== "string" || value.query.length > 500
      || !Number.isFinite(Date.parse(value.fetched_at)) || Date.parse(value.fetched_at) > now + 60000
      || now - Date.parse(value.fetched_at) > 7 * 86400000 || !Object.hasOwn(GROUPS, value.topic)) return null;
  try {
    return { schema: 1, context: key, topic: value.topic, period: value.period, query: value.query,
      fetched_at: value.fetched_at, results: cleanResults(value, GROUPS[value.topic]) };
  } catch { return null; }
}

export class DiscoveryController {
  constructor({ web, storage, getContext, restoreOptions = () => {}, changed = () => {}, now = () => new Date().toISOString() }) {
    this.web = web; this.storage = storage; this.getContext = getContext; this.restoreOptions = restoreOptions; this.changed = changed; this.now = now;
    this.busy = false; this.epoch = 0; this.state = null; this.pages = new Map(); this.error = ""; this.saveFailed = false; this.quota = null;
  }
  key() { const { profile, options } = this.getContext(); return contextKey(profile, options); }
  invalidate() { this.epoch++; this.state = null; this.pages.clear(); this.error = "conditions_changed"; this.quota = null; this.changed(); }
  async restore() {
    const epoch = this.epoch, key = this.key();
    try {
      const stored = await this.storage.get({ key: DISCOVERY_KEY });
      if (epoch === this.epoch && key === this.key()) {
        const value = stored?.value;
        if (value?.schema === 1 && Object.hasOwn(GROUPS, value.topic) && WINDOWS.has(value.period)) {
          const proposed = { topic: value.topic, period: value.period };
          const proposedKey = contextKey(this.getContext().profile, proposed);
          const restored = restoreDiscovery(value, proposedKey);
          if (restored) { this.restoreOptions(proposed); this.state = restored; }
        }
      }
    } catch { /* A private search cache is optional; core catalog stays usable. */ }
    this.changed();
  }
  async search(consent) {
    if (consent !== true) throw new Error("consent_required");
    if (this.busy) return;
    const epoch = ++this.epoch, key = this.key();
    const { profile, options } = this.getContext();
    const spec = searchSpec(profile, options);
    this.busy = true; this.state = null; this.pages.clear(); this.error = ""; this.saveFailed = false; this.quota = null; this.changed();
    try {
      if (typeof this.web?.search !== "function") throw new Error("web_unavailable");
      const reply = await this.web.search(spec.request, { timeoutMs: 60000 });
      if (epoch !== this.epoch || key !== this.key()) return;
      const results = cleanResults(reply, spec.request.include_domains);
      this.state = { schema: 1, context: key, topic: spec.topic, period: spec.period, query: spec.query, fetched_at: this.now(), results };
      this.quota = Number.isFinite(reply.quota_consumed) && reply.quota_consumed >= 0 ? reply.quota_consumed : null;
      try { await this.storage.set({ key: DISCOVERY_KEY, value: this.state, ttl_seconds: 7 * 86400 }); } catch { this.saveFailed = true; }
    } catch (error) {
      if (epoch === this.epoch) this.error = error?.code === "APP_NOT_GRANTED" || /APP_NOT_GRANTED/.test(error?.message ?? "") ? "grant_required" : "search_failed";
    } finally { this.busy = false; this.changed(); }
  }
  async fetchPage(url, consent) {
    if (consent !== true) throw new Error("consent_required");
    if (this.busy) return;
    if (!this.state?.results.some(item => item.url === url) || sourceUrl(url) !== url) throw new Error("unknown_source");
    const epoch = this.epoch, key = this.key();
    this.busy = true; this.error = ""; this.quota = null; this.pages.delete(url); this.changed();
    try {
      if (typeof this.web?.fetch !== "function") throw new Error("web_unavailable");
      const reply = await this.web.fetch({ urls: [url], format: "text", max_chars: 6000, timeout_ms: 20000 }, { timeoutMs: 45000 });
      if (epoch !== this.epoch || key !== this.key()) return;
      this.quota = Number.isFinite(reply.quota_consumed) && reply.quota_consumed >= 0 ? reply.quota_consumed : null;
      this.pages.set(url, { ...cleanPage(reply, url), fetched_at: this.now() });
    } catch (error) {
      if (epoch === this.epoch) this.error = error?.code === "APP_NOT_GRANTED" ? "grant_required" : "page_failed";
    } finally { this.busy = false; this.changed(); }
  }
}
