// Created by Umoy / MoyPico Studio
import assert from "node:assert/strict";
import test from "node:test";
import { deadlineCoverage } from "../bundle/radar-state.mjs";

test("empty-search coverage follows region, eligibility, expiry and inclusive deadline rules", () => {
  const base = { availability: "active", regions: ["GLOBAL"], deadline: null, student_required: false, researcher_required: false };
  const catalog = { opportunities: [
    { ...base, id: "undated" },
    { ...base, id: "today", deadline: "2026-10-21" },
    { ...base, id: "past", deadline: "2026-10-20" },
    { ...base, id: "ended", availability: "expired" },
    { ...base, id: "japan", regions: ["JP"], deadline: "2026-10-22" },
    { ...base, id: "student", student_required: true, deadline: "2026-10-22" },
    { ...base, id: "research", researcher_required: true },
  ] };
  const profile = { country: "OTHER", student: false, researcher: false };
  assert.deepEqual(deadlineCoverage(catalog, profile, "2026-10-21"), { total: 2, dated: 1 });
  assert.deepEqual(deadlineCoverage(catalog, { ...profile, student: true, researcher: true }, "2026-10-21"), { total: 4, dated: 2 });
  assert.deepEqual(deadlineCoverage(catalog, { ...profile, country: "JP" }, "2026-10-21"), { total: 3, dated: 2 });
});
