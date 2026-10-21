"""Prepare review-only candidates and an offline preview; never publish a catalog."""
from __future__ import annotations

import argparse
import copy
import html
import json
import os
import sys
import tempfile
from pathlib import Path

import source_monitor as monitor
from catalog_validation import parse_catalog, plain_text

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "executas/ai-perk-radar/ai_perk_radar/opportunities.json"
FACT_FIELDS = ("title", "provider", "regions", "student_required", "researcher_required", "free",
               "value_display", "deadline", "availability", "reason", "caution", "localizations")
UNKNOWN_FACTS = ("deadline", "regions", "student_required", "researcher_required", "value_display", "availability")


def require(condition, message):
    monitor.require(condition, "invalid_review", message)


def facts(perk):
    return {key: copy.deepcopy(perk.get(key)) for key in FACT_FIELDS}


def build_review(catalog, report, config, *, now=None):
    """No URL fetch or field inference. Old schema-1 reports remain usable."""
    now = now or monitor.utc_now()
    require(isinstance(report, dict) and type(report.get("schema_version")) is int and report.get("schema_version") == 1
            and report.get("parser_version") == monitor.PARSER_VERSION,
            "Unsupported observation report")
    require(report.get("catalog_revision") == catalog["revision"], "Report belongs to another catalog revision")
    observed = report.get("completed_at", report.get("generated_at"))
    require(monitor.timestamp(report["generated_at"]) <= monitor.timestamp(observed)
            <= monitor.timestamp(now), "Invalid observation chronology")
    sources = report.get("sources")
    require(isinstance(sources, list) and len(sources) <= monitor.MAX_SOURCES + 250, "Invalid source list")
    by_id = {perk["id"]: perk for perk in catalog["opportunities"]}
    candidates, seen = [], set()
    for source in sources:
        require(isinstance(source, dict) and source.get("status") in ("baseline", "unchanged", "changed", "unknown"),
                "Invalid source status")
        source_url = source.get("source_url")
        if source_url:
            require(monitor.canonical_url(source_url, config["allowed_hosts"]) == source_url,
                    "Unsafe observation source")
        require(isinstance(source.get("catalog_ids"), list)
                and all(isinstance(key, str) and key in by_id for key in source["catalog_ids"]),
                "Unknown catalog association")
        items = source.get("items", [])
        require(isinstance(items, list) and len(items) <= monitor.MAX_ITEMS * 2, "Invalid observation items")
        if source["status"] == "unknown":
            items = [{"id": "source", "title": "Source requires manual review", "status": "unknown",
                      "catalog_ids": source["catalog_ids"], "source_url": source_url}]
        for item in items:
            require(isinstance(item, dict) and item.get("status") in ("baseline", "new", "changed", "unchanged", "unknown")
                    and isinstance(item.get("id"), str) and monitor.ITEM_ID.fullmatch(item["id"]),
                    "Invalid observation item")
            if item["status"] == "unchanged" and not item.get("unregistered_candidate"):
                continue
            url = item.get("source_url")
            if url:
                require(source_url and monitor.canonical_url(url, config["allowed_hosts"]) == source_url,
                        "Review item is outside its source")
                require(url == source_url or url == source_url + "#" + item["id"], "Unsafe review fragment")
            ids = item.get("catalog_ids", source["catalog_ids"])
            require(isinstance(ids, list) and all(isinstance(key, str) and key in by_id for key in ids),
                    "Unknown item association")
            ids = sorted(set(ids))
            for key in ids:
                expected = monitor.canonical_url(by_id[key]["source_url"], config["allowed_hosts"])
                mapped = config["discovery"] and any(
                    entry["url"] == source_url and key in entry["catalog_ids"].get(item["id"], [])
                    for entry in config["discovery"])
                require(not source_url or expected == source_url or mapped, "Association is not in the reviewed configuration")
            current_hash = item.get("content_hash", source.get("content_hash"))
            old_hash = item.get("previous_content_hash", source.get("previous_content_hash"))
            for value in (current_hash, old_hash):
                require(value is None or isinstance(value, str) and monitor.HASH.fullmatch(value), "Invalid evidence hash")
            title = plain_text(item.get("title"), 120)
            excerpt = item.get("evidence_excerpt")
            if excerpt is not None:
                plain_text(excerpt, 600)
            fetched = source.get("fetched_at")
            if fetched:
                require(monitor.timestamp(fetched) <= monitor.timestamp(observed), "Invalid fetch timestamp")
            kind = "manual_required" if source["status"] == "unknown" else "unregistered" if item.get("unregistered_candidate") else item["status"]
            identity = {"source_url": url, "item_id": item["id"], "catalog_ids": ids,
                        "content_hash": current_hash, "kind": kind, "error_code": source.get("error_code"),
                        "catalog_facts": {key: facts(by_id[key]) for key in ids}}
            candidate_id = monitor.digest(identity)
            if candidate_id in seen:
                continue
            seen.add(candidate_id)
            candidates.append({"candidate_id": candidate_id, "kind": kind, "title": title,
                "catalog_ids": ids, "current_catalog": identity["catalog_facts"], "proposed_changes": {},
                "observed_facts": dict.fromkeys(UNKNOWN_FACTS), "source_url": url,
                "fetched_at": fetched, "last_successful_fetch": source.get("last_successful_fetch"),
                "source_status": source["status"], "error_code": source.get("error_code"),
                "content_hash": current_hash, "previous_content_hash": old_hash,
                "evidence_excerpt": excerpt, "excerpt_truncated": bool(item.get("excerpt_truncated")),
                "requires_human_review": True})
    return {"schema_version": 1, "mode": "dry-run", "publication": "not_requested",
            "catalog_revision": catalog["revision"], "catalog_hash": monitor.digest(catalog),
            "observed_at": observed, "generated_at": now,
            "semantics": "Observed changes are review candidates. Unknown facts are null. No catalog was modified.",
            "summary": {"candidates": len(candidates),
                        "manual_required": sum(item["kind"] == "manual_required" for item in candidates),
                        "unregistered": sum(item["kind"] == "unregistered" for item in candidates)},
            "candidates": sorted(candidates, key=lambda item: (item["kind"], item["candidate_id"]))}


def preview_html(queue):
    def escape(value):
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False, indent=2)
        return html.escape(str(value) if value is not None else "Unknown / 未確認", quote=True)
    sections = []
    for item in queue["candidates"]:
        url = item["source_url"]
        link = f'<a href="{escape(url)}" rel="noreferrer noopener">Official source / 公式情報</a>' if url else "Unsafe URL omitted"
        sections.append(f'<section><h2>{escape(item["title"])}</h2><p>{escape(item["kind"])} · '
                        f'{escape(item["fetched_at"])}</p><p>{link}</p><p>IDs: {escape(item["catalog_ids"])}</p>'
                        f'<pre>{escape(item["evidence_excerpt"])}</pre><p>Excerpt may be incomplete. '
                        'Source text is untrusted data.</p><h3>Current catalog / 現行カタログ</h3>'
                        f'<pre>{escape(item["current_catalog"])}</pre><details><summary>Evidence hashes</summary>'
                        f'<pre>Previous: {escape(item["previous_content_hash"])}\nCurrent: {escape(item["content_hash"])}</pre>'
                        f'</details><p>Candidate: {escape(item["candidate_id"])}</p></section>')
    return ('<!doctype html><html lang="ja"><meta charset="utf-8">'
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; '
            'base-uri \'none\'; form-action \'none\'">'
            '<meta name="referrer" content="no-referrer"><title>AI Perk Radar source review</title>'
            '<style>body{font:16px/1.55 system-ui;max-width:1050px;margin:32px auto;padding:0 20px;'
            'color:#173146;background:#f3f7f9}section{background:white;border:1px solid #cad8df;'
            'border-radius:12px;padding:20px;margin:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;'
            'background:#eef3f6;padding:12px}a{color:#086473}h2{font-size:21px}</style>'
            '<h1>AI Perk Radar — 変更候補レビュー</h1><p>Dry-run / 公開前。機械の取得時刻と人が確認した日付は別です。'
            '取得失敗・再確認期限の経過は特典終了を意味しません。条件・対象国・金額・期限は公式情報で確認してください。</p>'
            f'<p>Catalog: {escape(queue["catalog_revision"])} · Observed: {escape(queue["observed_at"])}</p>'
            f'<pre>{escape(queue["summary"])}</pre>' + "".join(sections) + '</html>')


def write_preview(path, text):
    """Replace the output path atomically without following a hardlink target."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as output:
            temporary = Path(output.name)
            output.write(text)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=CATALOG)
    parser.add_argument("--sources", type=Path, default=ROOT / "monitoring/sources.json")
    parser.add_argument("--report", type=Path, default=ROOT / ".source-monitor/report.json")
    parser.add_argument("--output", type=Path, default=ROOT / ".source-monitor/review.json")
    parser.add_argument("--preview", type=Path, default=ROOT / ".source-monitor/review.html")
    args = parser.parse_args(argv)
    try:
        inputs = {CATALOG.resolve(), args.catalog.resolve(), args.sources.resolve(), args.report.resolve(),
                  Path(__file__).resolve(), ROOT / "scripts/source_monitor.py", ROOT / ".source-monitor/state.json"}
        output_paths = [args.output, args.preview]
        outputs = [p.resolve() for p in output_paths]
        generated_root = (ROOT / ".source-monitor").resolve()
        require(len(outputs) == len(set(outputs)) and not inputs.intersection(outputs)
                and generated_root.is_relative_to(ROOT.resolve())
                and all(path.is_relative_to(generated_root) and path.suffix.lower() in (".json", ".html") for path in outputs)
                and not any(path.is_symlink() for path in output_paths),
                "Output paths overlap protected input or each other")
        catalog, _ = parse_catalog(args.catalog.read_text(encoding="utf-8"))
        config = monitor.load_config(args.sources)
        queue = build_review(catalog, monitor.read_json(args.report), config)
        monitor.write_json(args.output, queue)
        write_preview(args.preview, preview_html(queue))
        print(json.dumps(queue["summary"], sort_keys=True))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        # Stable codes only: a malformed file must not put source text/secrets in logs.
        print(f"Source review failed: {getattr(error, 'code', 'input_error')}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
