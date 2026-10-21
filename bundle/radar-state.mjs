// Modified by Umoy / MoyPico Studio
// Persist visit metadata and saved labels, never a stale copy of offer terms.
export const KEYS = {
  profile: "ai-perk-radar:last-profile",
  settings: "ai-perk-radar:settings",
  visit: "ai-perk-radar:last-visit-v1",
  saved: "ai-perk-radar:saved-v1",
  savedItem: "ai-perk-radar:saved-v2/",
};
export const VIEWS = ["all", "new", "changed", "expiring", "forYou", "saved"];
const ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const MATERIAL_FIELDS = [
  "title", "provider", "regions", "student_required", "researcher_required", "interests",
  "free", "value_display", "deadline", "reason", "source_url", "availability",
  "caution", "parent_id", "offer_type", "localizations",
];

export function normalizeProfile(value) {
  if (!value || !["JP", "OTHER"].includes(value.country) || !["free", "value", "deadline"].includes(value.priority)) return null;
  const profile = { country: value.country, priority: value.priority };
  for (const field of ["student", "researcher", "developer", "creator", "founder", "limited_only"]) {
    if (typeof value[field] !== "boolean") return null;
    profile[field] = value[field];
  }
  if (!Array.isArray(value.interests)) return null;
  profile.interests = [...new Set(value.interests.filter(item => ["ai", "coding", "cloud", "research", "creator"].includes(item)))];
  return profile;
}

export function normalizeSaved(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const item of value.slice(0, 250)) {
    if (item && typeof item.id === "string" && ID.test(item.id) && typeof item.title === "string" && item.title.length <= 300 && typeof item.saved_at === "string") {
      unique.set(item.id, { id: item.id, title: item.title, saved_at: item.saved_at });
    }
  }
  return [...unique.values()];
}

export function normalizeVisit(value) {
  if (!value || value.schema !== 1 || !Number.isFinite(Date.parse(value.seen_at)) || !value.fingerprints || typeof value.fingerprints !== "object" || !Array.isArray(value.matched_ids)) return null;
  const fingerprints = {};
  const labels = {}, states = {};
  for (const [id, digest] of Object.entries(value.fingerprints).slice(0, 250)) {
    if (ID.test(id) && typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)) fingerprints[id] = digest;
    if (Object.hasOwn(fingerprints, id) && typeof value.labels?.[id] === "string") labels[id] = value.labels[id].slice(0, 160);
    if (Object.hasOwn(fingerprints, id) && ["active", "check", "expired"].includes(value.states?.[id])) states[id] = value.states[id];
  }
  return { schema: 1, seen_at: value.seen_at, fingerprints, labels, states,
    matched_ids: value.matched_ids.filter(id => typeof id === "string" && ID.test(id)).slice(0, 250) };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export async function visitSnapshot(catalog, results, seenAt = new Date().toISOString()) {
  const fingerprints = {};
  const labels = {}, states = {};
  for (const perk of catalog.opportunities) {
    const facts = Object.fromEntries(MATERIAL_FIELDS.map(key => [key, perk[key] ?? null]));
    for (const key of ["interests", "regions"]) facts[key] = [...(facts[key] ?? [])].sort();
    const bytes = new TextEncoder().encode(JSON.stringify(canonical(facts)));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    fingerprints[perk.id] = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    labels[perk.id] = perk.title.slice(0, 160);
    states[perk.id] = perk.availability === "expired" || (daysUntil(perk.deadline, seenAt.slice(0, 10)) ?? 0) < 0 ? "expired" : perk.availability;
  }
  return { schema: 1, seen_at: seenAt, fingerprints, labels, states, matched_ids: results.map(item => item.id) };
}

export function visitChanges(previous, current) {
  const result = { firstVisit: !previous, since: previous?.seen_at ?? null, new: new Set(), changed: new Set(), forYou: new Set(), unavailable: new Set() };
  if (!previous) return result;
  const oldMatches = new Set(previous.matched_ids);
  for (const id of current.matched_ids) {
    if (!Object.hasOwn(previous.fingerprints, id)) result.new.add(id);
    else {
      if (previous.fingerprints[id] !== current.fingerprints[id]) result.changed.add(id);
      if (!oldMatches.has(id)) result.forYou.add(id);
    }
  }
  const currentMatches = new Set(current.matched_ids);
  for (const id of previous.matched_ids) {
    if (!currentMatches.has(id) && (!Object.hasOwn(current.fingerprints, id) || current.states?.[id] === "expired" || previous.fingerprints[id] !== current.fingerprints[id])) {
      result.changed.add(id); result.unavailable.add(id);
    }
  }
  return result;
}

export function daysUntil(deadline, today = new Date().toISOString().slice(0, 10)) {
  if (!deadline) return null;
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return Number.isFinite(days) ? days : null;
}

export function isExpiring(perk, today) {
  const days = daysUntil(perk.deadline_raw ?? perk.deadline, today);
  return days !== null && days >= 0 && days <= 30;
}

export function needsRecheck(perk, today = new Date().toISOString().slice(0, 10)) {
  const checked = perk.last_checked || perk.verified_at;
  if (!checked) return true;
  const age = -daysUntil(checked, today);
  const cadence = (perk.deadline_raw ?? perk.deadline) || ["New", "Just launched"].includes(perk.freshness) ? 7 : 30;
  return age > cadence;
}

export function searchMatches(perk, query) {
  const fold = value => String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const haystack = fold([perk.title, perk.provider, perk.value_display, perk.why ?? perk.reason,
    perk.caution, ...Object.values(perk.localizations?.ja ?? {})].join(" "));
  return fold(query).trim().split(/\s+/).every(word => haystack.includes(word));
}

// Match the engine's eligibility gates without the deadline-only setting.
// Counts explain the current catalog; they do not add or verify any offers.
export function deadlineCoverage(catalog, profile, today = new Date().toISOString().slice(0, 10)) {
  const matching = (catalog?.opportunities ?? []).filter(perk =>
    perk.availability !== "expired" && (daysUntil(perk.deadline, today) ?? 0) >= 0
    && (perk.regions.includes("GLOBAL") || perk.regions.includes(profile.country))
    && (!perk.student_required || profile.student)
    && (!perk.researcher_required || profile.researcher));
  return { total: matching.length, dated: matching.filter(perk => Boolean(perk.deadline)).length };
}

export function filterMatches(results, { view = "all", query = "", type = "all", confirmed = false } = {}, changes, saved = [], today) {
  const savedIds = new Set(saved.map(item => item.id));
  return results.filter(perk => {
    if (type !== "all" && (type === "exclusive" ? perk.offer_type === "free_tier" : perk.offer_type !== type)) return false;
    if (confirmed && (perk.availability !== "active" || needsRecheck(perk, today))) return false;
    if (!searchMatches(perk, query)) return false;
    if (view === "saved") return savedIds.has(perk.id);
    if (view === "expiring") return isExpiring(perk, today);
    if (["new", "changed", "forYou"].includes(view)) return changes?.[view]?.has(perk.id) ?? false;
    return true;
  });
}

export function savedStatus(saved, catalog, results, today) {
  const matched = new Map(results.map(perk => [perk.id, perk]));
  const records = new Map((catalog?.opportunities ?? []).map(perk => [perk.id, perk]));
  return saved.map(item => {
    const record = records.get(item.id);
    let status = "matched";
    if (!catalog) status = "needsRefresh";
    else if (!record) status = "removed";
    else if (record.availability === "expired" || (daysUntil(record.deadline, today) ?? 0) < 0) status = "expired";
    else if (!matched.has(item.id)) status = "notMatched";
    return { ...item, title: record?.title ?? item.title, record, match: matched.get(item.id), status };
  });
}

// One key per perk avoids lost independent saves when the old aggregate row did not exist.
// Legacy bookmarks are read, never deleted; per-ID tombstones override them on removal.
export async function loadSaved(storage) {
  const legacy = await storage.get({ key: KEYS.saved });
  const map = new Map(normalizeSaved(legacy?.value).map(item => [item.id, item]));
  const cursors = new Set();
  let cursor;
  for (let page = 0; page < 20; page++) {
    const result = await storage.list({ prefix: KEYS.savedItem, limit: 100, ...(cursor ? { cursor } : {}) });
    if (!result || !Array.isArray(result.items)) throw new Error("invalid_saved_response");
    for (const row of result.items) {
      const item = row?.metadata;
      if (item?.schema !== 2 || !ID.test(item.id) || row.key !== KEYS.savedItem + item.id || typeof item.saved !== "boolean"
          || !Number.isFinite(Date.parse(item.changed_at))) continue;
      if (!item.saved) map.delete(item.id);
      else {
        const valid = normalizeSaved([item])[0];
        if (valid) map.set(item.id, valid);
      }
    }
    if (!result.next_cursor) return [...map.values()];
    if (typeof result.next_cursor !== "string" || cursors.has(result.next_cursor)) throw new Error("invalid_saved_cursor");
    cursor = result.next_cursor; cursors.add(cursor);
  }
  throw new Error("saved_pagination_limit");
}

export async function updateSaved(storage, change, now = new Date().toISOString()) {
  if (!ID.test(change?.id) || typeof change.title !== "string" || change.title.length > 300 || typeof change.saved !== "boolean") throw new Error("invalid_saved_change");
  const current = await loadSaved(storage);
  const existing = current.find(item => item.id === change.id);
  if (change.saved && !existing && current.length >= 250) throw new Error("saved_limit");
  const value = { schema: 2, id: change.id, title: change.title, saved: change.saved, saved_at: existing?.saved_at ?? now, changed_at: now };
  await storage.set({ key: KEYS.savedItem + change.id, value, metadata: value });
  return loadSaved(storage);
}
