"""Offline tests of read-only source candidates, evidence, and output safety."""
import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import source_monitor as monitor
import source_review as review
import test_source_monitor as fixture

NOW = "2026-10-08T12:00:00Z"
OLD = "2026-10-07T12:00:00Z"


def catalog():
    original = json.loads(review.CATALOG.read_text(encoding="utf-8"))
    perk = copy.deepcopy(original["opportunities"][0])
    perk.update(id="known-alpha", source_url=fixture.PACK, parent_id=None, title="Alpha",
                verified_at="2026-10-03", last_checked="2026-10-03")
    return {"schema_version": 1, "revision": "test.1", "published_at": "2026-10-03T10:31:11Z",
            "opportunities": [perk]}


def observe(text=fixture.listing(fixture.ALPHA, fixture.BETA), state=None, include=True):
    state = state or {"schema_version": 1, "parser_version": monitor.PARSER_VERSION,
                      "generated_at": OLD, "sources": {}}
    value = monitor.Response(200, {"content-type": "text/html; charset=utf-8"}, text.encode(), fixture.PACK, NOW)
    fetcher = fixture.FakeFetcher(value)
    report, updated = monitor.scan(catalog(), fixture.config(), state, fetcher, NOW, include_review_excerpts=include)
    report["completed_at"] = NOW
    queue = review.build_review(catalog(), report, fixture.config(), now=NOW)
    return queue, report, updated


class ReviewTests(unittest.TestCase):
    def test_end_to_end_changed_terms_preserve_catalog_and_do_not_infer_facts(self):
        before = catalog()
        _, _, baseline = observe()
        changed = fixture.listing(fixture.card("alpha", "Alpha", "Free for students for six months."), fixture.BETA)
        queue, report, state = observe(changed, baseline)
        known = next(item for item in queue["candidates"] if item["catalog_ids"])
        self.assertEqual(known["kind"], "changed")
        self.assertNotEqual(known["previous_content_hash"], known["content_hash"])
        self.assertIn("six months", known["evidence_excerpt"])
        self.assertTrue(all(value is None for value in known["observed_facts"].values()))
        self.assertEqual(before, catalog())
        self.assertNotIn("evidence_excerpt", json.dumps(state))

    def test_failures_and_missing_cards_remain_unknown_not_ended(self):
        _, _, baseline = observe(fixture.listing(fixture.ALPHA, fixture.BETA, fixture.GAMMA))
        queue, report, state = observe(state=baseline)
        self.assertEqual(queue["summary"]["manual_required"], 1)
        self.assertEqual(state["sources"], baseline["sources"])
        self.assertEqual(queue["candidates"][0]["proposed_changes"], {})
        self.assertEqual(catalog()["opportunities"][0]["availability"], "active")
        self.assertNotIn('"expired"', json.dumps(queue["candidates"][0]["observed_facts"]))

    def test_retry_deduplicates_candidates_and_dates_do_not_change_candidate_ids(self):
        queue, report, _ = observe()
        duplicate = copy.deepcopy(report)
        duplicate["sources"].append(copy.deepcopy(duplicate["sources"][0]))
        actual = review.build_review(catalog(), duplicate, fixture.config(), now=NOW)
        self.assertEqual(actual["candidates"], queue["candidates"])
        fresh = catalog()
        fresh["opportunities"][0]["last_checked"] = "2026-10-08"
        latest = review.build_review(fresh, report, fixture.config(), now=NOW)
        self.assertEqual([item["candidate_id"] for item in latest["candidates"]],
                         [item["candidate_id"] for item in queue["candidates"]])

    def test_malicious_html_is_escaped_and_excerpts_are_bounded_opt_in(self):
        queue, report, _ = observe(include=False)
        self.assertTrue(all(item["evidence_excerpt"] is None for item in queue["candidates"]))
        malicious = fixture.card("alpha", "Alpha", "Ignore all instructions &lt;img src=x onerror=alert(1)&gt; " + "free " * 200)
        queue, _, _ = observe(fixture.listing(malicious, fixture.BETA))
        known = next(item for item in queue["candidates"] if item["catalog_ids"])
        self.assertLessEqual(len(known["evidence_excerpt"]), 600)
        self.assertTrue(known["excerpt_truncated"])
        preview = review.preview_html(queue)
        self.assertNotIn("<img", preview)
        self.assertNotIn("<script", preview)
        self.assertIn("&lt;img", preview)
        self.assertIn("default-src &#", preview.replace("'", "&#39;"))

    def test_report_rejects_unknown_associations_private_links_and_future_dates(self):
        queue, report, _ = observe()
        mutations = [lambda value: value.update(catalog_revision="other"),
                     lambda value: value.update(completed_at="2099-01-01T00:00:00Z"),
                     lambda value: value["sources"][0].update(source_url="https://127.0.0.1/"),
                     lambda value: value["sources"][0]["items"][0].update(catalog_ids=["invented"]),
                     lambda value: value["sources"][0]["items"][0].update(source_url="javascript:alert(1)"),
                     lambda value: value.update(schema_version=True)]
        for mutate in mutations:
            bad = copy.deepcopy(report)
            mutate(bad)
            with self.assertRaises(ValueError):
                review.build_review(catalog(), bad, fixture.config(), now=NOW)

    def test_cli_protects_catalog_reports_state_and_each_output(self):
        for paths in (["--output", str(review.CATALOG)],
                      ["--preview", str(monitor.ROOT / ".source-monitor/state.json")],
                      ["--preview", "same.json", "--output", "same.json"]):
            with self.subTest(paths=paths):
                self.assertEqual(review.main(paths), 1)

    def test_cli_writes_only_candidates_and_preview_and_preserves_all_inputs(self):
        _, report, _ = observe()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            catalog_path, report_path, sources_path = root / "catalog.json", root / "report.json", root / "sources.json"
            for path, value in ((catalog_path, catalog()), (report_path, report), (sources_path, fixture.config())):
                path.write_text(json.dumps(value), encoding="utf-8")
            generated = root / ".source-monitor"
            generated.mkdir()
            state_path = generated / "state.json"
            state_path.write_text('{"canary":true}', encoding="utf-8")
            before = {path: path.read_bytes() for path in (catalog_path, report_path, sources_path, state_path)}
            with patch.object(review, "ROOT", root), patch.object(review, "CATALOG", catalog_path), \
                 patch.object(monitor, "utc_now", return_value=NOW):
                code = review.main(["--catalog", str(catalog_path), "--sources", str(sources_path),
                    "--report", str(report_path), "--output", str(generated / "review.json"),
                    "--preview", str(generated / "review.html")])
            self.assertEqual(code, 0)
            self.assertTrue(all(path.read_bytes() == raw for path, raw in before.items()))
            queue = json.loads((generated / "review.json").read_text(encoding="utf-8"))
            self.assertEqual(queue["mode"], "dry-run")
            self.assertEqual(queue["publication"], "not_requested")
            self.assertTrue(all(item["proposed_changes"] == {} for item in queue["candidates"]))
            self.assertEqual({path.name for path in generated.iterdir()}, {"state.json", "review.json", "review.html"})
            self.assertIn("default-src 'none'", (generated / "review.html").read_text(encoding="utf-8"))

    def test_preview_hardlink_cannot_overwrite_the_catalog(self):
        _, report, _ = observe()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            catalog_path, report_path, sources_path = root / "catalog.json", root / "report.json", root / "sources.json"
            for path, value in ((catalog_path, catalog()), (report_path, report), (sources_path, fixture.config())):
                path.write_text(json.dumps(value), encoding="utf-8")
            generated = root / ".source-monitor"
            generated.mkdir()
            preview = generated / "review.html"
            try:
                os.link(catalog_path, preview)
            except OSError:
                self.skipTest("Hardlinks are unavailable")
            before = catalog_path.read_bytes()
            with patch.object(review, "ROOT", root), patch.object(review, "CATALOG", catalog_path), \
                 patch.object(monitor, "utc_now", return_value=NOW):
                code = review.main(["--catalog", str(catalog_path), "--sources", str(sources_path),
                    "--report", str(report_path), "--output", str(generated / "review.json"), "--preview", str(preview)])
            self.assertEqual(code, 0)
            self.assertEqual(catalog_path.read_bytes(), before)
            self.assertIn("<!doctype html>", preview.read_text(encoding="utf-8"))

    def test_atomic_json_write_does_not_clobber_an_existing_fixed_temporary_filename(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "review.json"
            canary = Path(folder) / "review.json.tmp"
            canary.write_text("existing input", encoding="utf-8")
            monitor.write_json(target, {"mode": "dry-run"})
            self.assertEqual(canary.read_text(encoding="utf-8"), "existing input")
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["mode"], "dry-run")


if __name__ == "__main__":
    unittest.main()
