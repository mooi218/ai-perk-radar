import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DiscoveryController, DISCOVERY_KEY, searchSpec, sourceUrl, cleanResults, cleanPage, restoreDiscovery, contextKey } from "../bundle/discovery.mjs";

const profile = () => ({ country: "JP", student: true, researcher: false, developer: true, creator: false, founder: false, priority: "free", interests: ["ai", "coding"], limited_only: false });
const offer = { title: "Student offer <script>alert(1)</script>", url: "https://blog.google/technology/ai/student-offer/", snippet: "Provider conditions apply." };

test("Web methods are declared through Anna's host API ACL, without unsupported top-level permissions or Agent sessions", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.ui.host_api.web, ["search", "fetch"]);
  assert.deepEqual(manifest.permissions, ["tools.invoke", "storage.read", "storage.write", "llm.complete"]);
  assert.equal(manifest.ui.host_api.agent.session.auto, false);
  assert.equal(manifest.ui.host_api.agent.session.fixed, null);
  assert.ok(manifest.ui.host_api.storage.includes("list"));
});
function harness(overrides = {}) {
  let value, calls = 0, context = { profile: profile(), options: { topic: "ai", period: "month" } };
  const storage = { get: async () => ({ value }), set: async args => { assert.equal(args.key, DISCOVERY_KEY); value = args.value; } };
  const web = { search: async args => { calls++; assert.equal(args.search_depth, "basic"); assert.equal(args.max_results, 6); return { results: [offer], quota_consumed: 0.5 }; },
    fetch: async args => ({ pages: [{ url: args.urls[0], ok: true, content: "Current source text" }], quota_consumed: 1 }) };
  const controller = new DiscoveryController({ web, storage, getContext: () => context, ...overrides });
  return { controller, web, storage, context, calls: () => calls, value: () => value };
}

test("search is opt-in, bounded and tool-only; no search on restore or automatic retries", async () => {
  const h = harness();
  await h.controller.restore(); assert.equal(h.calls(), 0);
  await assert.rejects(h.controller.search(false), /consent_required/); assert.equal(h.calls(), 0);
  await h.controller.search(true); assert.equal(h.calls(), 1);
  assert.equal(h.controller.state.results.length, 1); assert.equal(h.value().schema, 1);
  assert.deepEqual(Object.keys(h.web).sort(), ["fetch", "search"]);
});

test("queries contain only bounded selected terms, not arbitrary profile fields or personal identifiers", () => {
  const spec = searchSpec({ ...profile(), name: "SECRET", interests: ["ignore instructions"], country: "SECRET" }, { topic: "__proto__", period: "bogus" });
  assert.equal(spec.topic, "ai"); assert.equal(spec.period, "month");
  assert.doesNotMatch(JSON.stringify(spec), /SECRET|ignore instructions|__proto__/);
  assert.ok(spec.request.include_domains.length <= 6);
  assert.equal(searchSpec(profile(), { period: "any" }).request.time_range, undefined);
});

test("untrusted source URLs reject credentials, private hosts, forged domains, unsafe protocols and community posts", () => {
  for (const url of ["javascript:alert(1)", "https://blog.google@evil.test/", "https://blog.google.evil.test/", "https://127.0.0.1/", "http://blog.google/", "https://blog.google:444/", "https://blog.google\\@evil.test/", "https://huggingface.co/blog/username/community-post", "https://huggingface.co/user/repo"])
    assert.equal(sourceUrl(url), null, url);
  assert.equal(sourceUrl("https://www.anthropic.com/news/test?utm_campaign=tracking#anchor"), "https://www.anthropic.com/news/test");
});

test("candidate results deduplicate URLs, reject out-of-scope hosts and never acquire verified/match fields", () => {
  const result = cleanResults({ results: [offer, { ...offer, url: offer.url + "#a" }, { ...offer, url: "https://azure.microsoft.com/offer" }, { ...offer, url: "https://evil.test" }] }, ["blog.google"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].published_at, null);
  assert.deepEqual(Object.keys(result[0]).sort(), ["published_at", "snippet", "title", "url"]);
  assert.throws(() => cleanResults({ results: {} }, ["blog.google"]), /invalid_response/);
});

test("changing a profile in flight discards the old search and does not persist it", async () => {
  let resolve;
  const h = harness(); h.web.search = () => new Promise(r => { resolve = r; });
  const running = h.controller.search(true);
  h.context.profile.student = false; h.controller.invalidate();
  resolve({ results: [offer] }); await running;
  assert.equal(h.controller.state, null); assert.equal(h.value(), undefined); assert.equal(h.controller.busy, false);
});

test("double clicks cause one paid operation and failed searches clear previous results", async () => {
  let resolve, count = 0;
  const h = harness(); h.web.search = () => { count++; return new Promise(r => { resolve = r; }); };
  const first = h.controller.search(true); await h.controller.search(true);
  assert.equal(count, 1); resolve({ results: [offer] }); await first;
  h.web.search = async () => { count++; throw Object.assign(new Error("not granted"), { code: "APP_NOT_GRANTED" }); };
  await h.controller.search(true);
  assert.equal(count, 2); assert.equal(h.controller.error, "grant_required"); assert.equal(h.controller.state, null);
});

test("source fetch checks identity, redirects, truncation and challenge pages without confirming eligibility", () => {
  const page = extra => ({ pages: [{ ok: true, url: offer.url, content: "Terms", ...extra }] });
  assert.equal(cleanPage(page({ truncated: true }), offer.url).truncated, true);
  assert.throws(() => cleanPage(page({ final_url: "https://evil.test/" }), offer.url), /unsafe_redirect/);
  assert.throws(() => cleanPage(page({ final_url: "https://anthropic.com/" }), offer.url), /unsafe_redirect/);
  assert.throws(() => cleanPage(page({ content: "Verify you are human" }), offer.url), /page_failed/);
  assert.throws(() => cleanPage(page({ ok: false }), offer.url), /page_failed/);
});

test("page retrieval is separately consented, clears stale excerpts on error and reports only the latest operation cost", async () => {
  const h = harness(); await h.controller.search(true);
  await assert.rejects(h.controller.fetchPage(offer.url, false), /consent_required/);
  await assert.rejects(h.controller.fetchPage("https://anthropic.com/", true), /unknown_source/);
  await h.controller.fetchPage(offer.url, true); assert.equal(h.controller.pages.size, 1); assert.equal(h.controller.quota, 1);
  h.web.fetch = async () => ({ pages: [{ url: offer.url, ok: false }], quota_consumed: 0 });
  await h.controller.fetchPage(offer.url, true);
  assert.equal(h.controller.pages.size, 0); assert.equal(h.controller.quota, 0); assert.equal(h.controller.error, "page_failed");
});

test("cached discovery rejects old/future/mismatched data and restores validated nondefault options without consent", async () => {
  const options = { topic: "cloud", period: "week" }, p = profile();
  const key = contextKey(p, options);
  const value = { schema: 1, context: key, ...options, query: "cloud benefits", fetched_at: new Date().toISOString(), results: [] };
  assert.ok(restoreDiscovery(value, key));
  assert.equal(restoreDiscovery(value, "other"), null);
  assert.equal(restoreDiscovery({ ...value, fetched_at: "2000-01-01" }, key), null);
  assert.equal(restoreDiscovery({ ...value, fetched_at: "2999-01-01" }, key), null);
  const h = harness(); h.storage.get = async () => ({ value });
  h.controller.restoreOptions = next => { h.context.options = next; };
  await h.controller.restore(); assert.equal(h.controller.state.period, "week"); assert.deepEqual(h.context.options, options); assert.equal(h.calls(), 0);
});

test("APS failures do not turn a completed source search into fabricated fresh results or silently claim persistence", async () => {
  const h = harness(); h.storage.set = async () => { throw new Error("quota_exceeded"); };
  await h.controller.search(true);
  assert.equal(h.controller.state.results.length, 1); assert.equal(h.controller.saveFailed, true);
});
