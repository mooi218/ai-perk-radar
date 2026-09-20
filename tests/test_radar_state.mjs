import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProfile, normalizeSaved, normalizeVisit, visitSnapshot, visitChanges,
  daysUntil, isExpiring, needsRecheck, filterMatches, savedStatus, updateSaved, loadSaved, KEYS } from "../bundle/radar-state.mjs";

const perk = (id, extra = {}) => ({ id, title: id, provider: "Example", value_display: "Free", reason: "Current terms", why: "Matched", regions: ["GLOBAL"], interests: ["coding"],
  offer_type: "free_tier", availability: "active", last_checked: "2026-09-01", localizations: { ja: { reason: "学習向け" } }, ...extra });
const catalog = opportunities => ({ opportunities });
const saved = id => ({ id, title: id, saved_at: "2026-09-01T00:00:00Z" });

test("first visit is a baseline, not a false new-catalog alert", async () => {
  const items = [perk("a"), perk("b")];
  const snapshot = await visitSnapshot(catalog(items), items);
  const changes = visitChanges(null, snapshot);
  assert.equal(changes.firstVisit, true);
  assert.equal(changes.new.size, 0);
  assert.equal(changes.changed.size, 0);
});

test("real changes, added catalog entries, and newly matching existing entries are distinct", async () => {
  const beforeItems = [perk("changed"), perk("later-eligible")];
  const before = await visitSnapshot(catalog(beforeItems), [beforeItems[0]]);
  const afterItems = [perk("changed", { value_display: "New benefit" }), perk("later-eligible"), perk("new-entry")];
  const after = await visitSnapshot(catalog(afterItems), afterItems);
  const changes = visitChanges(before, after);
  assert.deepEqual([...changes.new], ["new-entry"]);
  assert.deepEqual([...changes.changed], ["changed"]);
  assert.deepEqual([...changes.forYou], ["later-eligible"]);
  assert.deepEqual([...visitChanges(before, after).new], ["new-entry"], "a same-session refresh keeps the original comparison base");
  assert.equal(visitChanges(after, after).new.size, 0, "the next visit starts from the last successful snapshot");
});

test("source rechecks, ranking changes, ordering, and publication dates do not masquerade as changed terms", async () => {
  const item = perk("a", { interests: ["ai", "coding"], match_score: 70 });
  const before = await visitSnapshot(catalog([item]), [item]);
  const revised = { ...item, interests: ["coding", "ai"], last_checked: "2026-09-10", verified_at: "2026-09-10", value_score: 99, match_score: 90 };
  const after = await visitSnapshot(catalog([revised]), [revised]);
  assert.equal(visitChanges(before, after).changed.size, 0);
  revised.localizations = { ja: { reason: "更新された対象条件" } };
  assert.equal(visitChanges(before, await visitSnapshot(catalog([revised]), [revised])).changed.size, 1);
});

test("changed view retains removed, expired and newly-ineligible prior matches without false profile-only changes", async () => {
  const beforeItems = [perk("removed"), perk("expired"), perk("restricted"), perk("profile-only")];
  const before = await visitSnapshot(catalog(beforeItems), beforeItems, "2026-09-01T00:00:00Z");
  const afterItems = [perk("expired", { availability: "expired" }), perk("restricted", { student_required: true }), perk("profile-only")];
  const after = await visitSnapshot(catalog(afterItems), [], "2026-09-20T00:00:00Z");
  const changes = visitChanges(before, after);
  assert.deepEqual([...changes.changed].sort(), ["expired", "removed", "restricted"]);
  assert.deepEqual([...changes.unavailable].sort(), ["expired", "removed", "restricted"]);
  assert.equal(before.labels.removed, "removed");
  assert.equal(normalizeVisit(before).labels.removed, "removed");
});

test("elapsed deadline is surfaced even when catalog facts were not edited", async () => {
  const item = perk("deadline", { deadline: "2026-09-10" });
  const before = await visitSnapshot(catalog([item]), [item], "2026-09-10T00:00:00Z");
  const after = await visitSnapshot(catalog([item]), [], "2026-09-11T00:00:00Z");
  assert.equal(before.fingerprints.deadline, after.fingerprints.deadline);
  assert.ok(visitChanges(before, after).unavailable.has("deadline"));
});

test("deadline filters include today and exactly 30 days, exclude expired and undated entries", () => {
  const today = "2026-09-10";
  assert.equal(daysUntil("2026-09-10", today), 0);
  assert.equal(isExpiring({ deadline_raw: "2026-10-10" }, today), true);
  assert.equal(isExpiring({ deadline_raw: "2026-10-11" }, today), false);
  assert.equal(isExpiring({ deadline_raw: "2026-09-09" }, today), false);
  assert.equal(isExpiring({}, today), false);
  assert.equal(needsRecheck(perk("a", { deadline_raw: "2026-10-10" }), today), true);
  assert.equal(needsRecheck(perk("a"), today), false);
});

test("search, category, confirmed state and saved filters combine without changing rank", () => {
  const items = [perk("codedex", { title: "Codédex Club", offer_type: "student_perk", match_score: 99 }), perk("check", { title: "Codédex uncertain", availability: "check" }), perk("other")];
  assert.deepEqual(filterMatches(items, { query: "codedex", type: "exclusive", confirmed: true }, null, [], "2026-09-10").map(p => p.id), ["codedex"]);
  assert.equal(filterMatches(items, { query: "学習" }).length, 3);
  assert.deepEqual(filterMatches(items, { view: "saved" }, null, [saved("other")]).map(p => p.id), ["other"]);
});

test("saved labels distinguish unavailable, expired, not-matching and never-refreshed items", () => {
  const savedItems = [saved("live"), saved("ended"), saved("removed"), saved("unmatched")];
  const records = [perk("live"), perk("ended", { availability: "expired" }), perk("unmatched")];
  assert.deepEqual(savedStatus(savedItems, catalog(records), [records[0]], "2026-09-10").map(p => p.status), ["matched", "expired", "removed", "notMatched"]);
  assert.ok(savedStatus(savedItems, null, []).every(p => p.status === "needsRefresh"));
});

test("per-ID APS records preserve legacy data and concurrent first-time saves from two windows", async () => {
  const rows = new Map();
  const storage = {
    get: async () => ({ value: [saved("existing")], exists: true }),
    list: async () => ({ items: [...rows.values()], next_cursor: null }),
    set: async args => { rows.set(args.key, { key: args.key, metadata: args.metadata }); },
  };
  await Promise.all([updateSaved(storage, { id: "first", title: "First", saved: true }), updateSaved(storage, { id: "second", title: "Second", saved: true })]);
  assert.deepEqual((await loadSaved(storage)).map(p => p.id).sort(), ["existing", "first", "second"]);
  await updateSaved(storage, { id: "existing", title: "Existing", saved: false });
  assert.deepEqual((await loadSaved(storage)).map(p => p.id).sort(), ["first", "second"]);
  assert.equal(rows.get(KEYS.savedItem + "existing").metadata.saved, false);
});

test("saved-record pagination follows cursors and does not silently accept malformed or endless responses", async () => {
  const meta = id => ({ schema: 2, ...saved(id), saved: true, changed_at: "2026-09-20T00:00:00Z" });
  const storage = { get: async () => ({ exists: false }), list: async args => args.cursor
    ? { items: [{ key: KEYS.savedItem + "second", metadata: meta("second") }], next_cursor: null }
    : { items: [{ key: KEYS.savedItem + "first", metadata: meta("first") }], next_cursor: "page-two" } };
  assert.equal((await loadSaved(storage)).length, 2);
  storage.list = async () => ({ items: [], next_cursor: "same" });
  await assert.rejects(loadSaved(storage), /invalid_saved_cursor/);
});

test("failed persistence is surfaced instead of claiming a save succeeded", async () => {
  await assert.rejects(updateSaved({ get: async () => ({ exists: false }), list: async () => ({ items: [], next_cursor: null }), set: async () => { throw new Error("quota_exceeded"); } }, { id: "a", title: "A", saved: true }), /quota_exceeded/);
});

test("restoration rejects corrupt state and ignores unknown profile fields", () => {
  assert.equal(normalizeProfile({ country: "JP" }), null);
  assert.equal(normalizeVisit({ schema: 99 }), null);
  assert.deepEqual(normalizeSaved([{ title: "missing ID", saved_at: "now" }]), []);
  const profile = normalizeProfile({ country: "JP", priority: "free", student: true, researcher: false, developer: true, creator: false, founder: false, limited_only: false, interests: ["ai", "unknown", "ai"], token: "not-to-store" });
  assert.deepEqual(profile.interests, ["ai"]);
  assert.equal(profile.token, undefined);
});
