import copy
import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import ai_perk_radar_plugin as matcher
from catalog_validation import CatalogError, MAX_CATALOG_BYTES, parse_catalog

CATALOG = json.loads((ROOT / "ai_perk_radar/opportunities.json").read_text(encoding="utf-8"))
PROFILE = {"country": "JP", "student": True, "researcher": True, "developer": True,
           "creator": False, "founder": False, "limited_only": False,
           "priority": "free", "interests": ["ai", "coding", "cloud"]}


def match(catalog):
    return matcher.find_perks({**PROFILE, "catalog_json": json.dumps(catalog, ensure_ascii=False)})


class CatalogTests(unittest.TestCase):
    def test_data_only_update_changes_same_matcher_without_reinstall(self):
        before = match(CATALOG)
        updated = copy.deepcopy(CATALOG)
        updated["revision"] += ".update"
        updated["opportunities"] = [p for p in updated["opportunities"] if p["id"] != "zed-student-plan-2026"]
        aws = next(p for p in updated["opportunities"] if p["id"] == "aws-student-rewards-2026")
        aws["availability"] = "expired"
        azure = next(p for p in updated["opportunities"] if p["id"] == "azure-for-students")
        azure["value_display"] = "Updated catalog value"
        azure["localizations"]["ja"]["value_display"] = "更新された特典内容"
        new = copy.deepcopy(azure)
        new["id"] = "new-test-opportunity"
        new["title"] = "New test opportunity"
        updated["opportunities"].append(new)
        after = match(updated)
        before_ids = {p["id"] for p in before["results"]}
        after_by_id = {p["id"]: p for p in after["results"]}
        self.assertIn("aws-student-rewards-2026", before_ids)
        self.assertNotIn("aws-student-rewards-2026", after_by_id)
        self.assertNotIn("zed-student-plan-2026", after_by_id)
        self.assertIn("new-test-opportunity", after_by_id)
        self.assertEqual(after_by_id["azure-for-students"]["value_display"], "Updated catalog value")
        self.assertEqual(after_by_id["azure-for-students"]["localizations"]["ja"]["value_display"], "更新された特典内容")
        self.assertNotEqual(before["catalog"]["sha256"], after["catalog"]["sha256"])
        self.assertEqual(after["recommended"]["match_score"], max(p["match_score"] for p in after["results"] if p["availability"] == "active"))

    def test_explicit_expiry_and_elapsed_deadline_are_excluded(self):
        catalog = copy.deepcopy(CATALOG)
        catalog["opportunities"][0]["deadline"] = "2000-01-01"
        catalog["opportunities"][1]["availability"] = "expired"
        ids = {p["id"] for p in match(catalog)["results"]}
        self.assertNotIn(catalog["opportunities"][0]["id"], ids)
        self.assertNotIn(catalog["opportunities"][1]["id"], ids)

    def test_empty_catalog_is_valid_and_does_not_restore_bundled_records(self):
        catalog = {**CATALOG, "opportunities": []}
        result = match(catalog)
        self.assertEqual(result["results"], [])
        self.assertIsNone(result["recommended"])

    def test_missing_or_bad_catalog_fails_closed(self):
        for raw in (None, "not JSON", "{}", "[]"):
            with self.subTest(raw=raw):
                reply = matcher.invoke("find_perks", {**PROFILE, "catalog_json": raw})
                self.assertFalse(reply["success"])
                self.assertNotIn("data", reply)

    def test_rejects_unsafe_or_malformed_data(self):
        mutations = [
            lambda c: c.update(schema_version=2),
            lambda c: c.update(schema_version=True),
            lambda c: c.update(script="alert(1)"),
            lambda c: c.update(published_at="yesterday"),
            lambda c: c["opportunities"].append(copy.deepcopy(c["opportunities"][0])),
            lambda c: c["opportunities"][0].update(source_url="javascript:alert(1)"),
            lambda c: c["opportunities"][0].update(source_url="https://user:secret@example.com/"),
            lambda c: c["opportunities"][0].update(source_url="https://127.0.0.1/"),
            lambda c: c["opportunities"][0].update(deadline="2026-02-30"),
            lambda c: c["opportunities"][0].update(student_required="false"),
            lambda c: c["opportunities"][0].update(value_score=True),
            lambda c: c["opportunities"][0].update(value_score=999),
            lambda c: c["opportunities"][0].update(availability="maybe"),
            lambda c: c["opportunities"][0].update(title="Cod\ufffddex"),
            lambda c: c["opportunities"][0].update(script_url="https://evil.example/payload.js"),
            lambda c: c["opportunities"][0].update(parent_id="missing-perk"),
            lambda c: c["opportunities"][0].update(localizations={"ja": {"code": "do_something()"}}),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                catalog = copy.deepcopy(CATALOG)
                mutate(catalog)
                with self.assertRaises(CatalogError):
                    parse_catalog(json.dumps(catalog))

    def test_limits_duplicates_and_nonfinite_numbers(self):
        for raw in (" " * (MAX_CATALOG_BYTES + 1), "\ufeff{}", '{"schema_version":1,"schema_version":1}', '{"score":NaN}', '"\\ud800"'):
            with self.subTest(raw=raw[:50]):
                with self.assertRaises(CatalogError):
                    parse_catalog(raw)

    def test_does_not_claim_data_download_reverifies_source_dates(self):
        before = {p["id"]: p["last_checked"] for p in CATALOG["opportunities"]}
        for result in match(CATALOG)["results"]:
            self.assertEqual(result["last_checked"], before[result["id"]])


if __name__ == "__main__":
    unittest.main()
