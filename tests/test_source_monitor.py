"""Offline regression tests for boundaries that could create false freshness."""
import copy
import json
import socket
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_monitor as monitor

NOW = "2026-09-20T12:00:00Z"
OLD = "2026-09-18T12:00:00Z"
PACK = "https://education.github.com/pack"
HOSTS = ["education.github.com", "example.com"]


def page(content, title="Official offers"):
    return f"<!doctype html><html><head><title>{title}</title></head><body>{content}</body></html>"


def card(item_id, title, terms):
    return (f'<div class="pack-offer-card"><h3 id="{item_id}">{title}</h3>'
            f'<h4>About {title}</h4><p>Product description</p><h4>Offers</h4>'
            f'<div><h5>Offer</h5><p>{terms}</p><h6>Tags</h6><ul><li>Learn</li></ul></div></div>')


def listing(*offers):
    return page('<main><h1>GitHub Student Developer Pack</h1>' + ''.join(offers) + '</main>')


ALPHA = card("alpha", "Alpha", "Free for verified students for one year.")
BETA = card("beta", "Beta", "$50 credit with the student subscription.")
GAMMA = card("gamma", "Gamma", "Free access to introductory programming courses.")


def response(body, status=200, url=PACK, media="text/html; charset=utf-8", headers=None):
    return monitor.Response(status, {"content-type": media, **(headers or {})}, body.encode(), url, NOW)


def config():
    return {"schema_version": 1, "allowed_hosts": HOSTS, "discovery": [
        {"url": PACK, "adapter": "github_pack", "min_items": 2, "catalog_ids": {"alpha": ["known-alpha"]}}
    ]}


def catalog():
    return {"revision": "test.1", "opportunities": [
        {"id": "known-alpha", "source_url": PACK + "/", "verified_at": "2026-09-01", "last_checked": "2026-09-01"},
        {"id": "pack", "source_url": PACK, "verified_at": "2026-09-01", "last_checked": "2026-09-01"},
    ]}


def empty_state():
    return {"schema_version": 1, "parser_version": monitor.PARSER_VERSION, "generated_at": OLD, "sources": {}}


class FakeFetcher:
    def __init__(self, value):
        self.value, self.calls = value, []

    def fetch(self, url):
        self.calls.append(url)
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


def scan(html=listing(ALPHA, BETA), state=None, input_catalog=None):
    fetcher = FakeFetcher(response(html))
    result = monitor.scan(input_catalog or catalog(), config(), state or empty_state(), fetcher, NOW)
    return *result, fetcher


class SourceMonitorTests(unittest.TestCase):
    def test_reviewed_configuration_covers_current_catalog_hosts_and_pack_records(self):
        configured = monitor.load_config(monitor.ROOT / "monitoring/sources.json")
        current = json.loads((monitor.ROOT / "executas/ai-perk-radar/ai_perk_radar/opportunities.json").read_text(encoding="utf-8"))
        mapped = {item for source in configured["discovery"] for ids in source["catalog_ids"].values() for item in ids}
        for perk in current["opportunities"]:
            with self.subTest(perk=perk["id"]):
                monitor.canonical_url(perk["source_url"], configured["allowed_hosts"])
                if perk["id"].startswith("github-pack-"):
                    self.assertIn(perk["id"], mapped)

    def test_initial_discovery_is_not_new_announcement_and_deduplicates_sources(self):
        original = catalog()
        report, state, fetcher = scan(input_catalog=original)
        self.assertEqual(fetcher.calls, [PACK])
        self.assertEqual(report["baseline_status"], "initial")
        self.assertEqual(report["summary"]["baseline"], 1)
        self.assertEqual(report["summary"]["observed_sources"], 1)
        self.assertEqual(report["summary"]["unregistered_candidates"], 1)
        items = report["sources"][0]["items"]
        self.assertEqual([item["status"] for item in items], ["baseline", "baseline"])
        self.assertFalse(items[0]["unregistered_candidate"])
        self.assertTrue(items[1]["unregistered_candidate"])
        self.assertEqual(original, catalog())
        self.assertNotIn("verified_at", json.dumps(state))
        self.assertNotIn("last_checked", json.dumps(state))
        self.assertNotIn("Free for verified students", json.dumps(state))

    def test_new_offer_and_changed_terms_are_detected_beyond_catalog(self):
        _, state, _ = scan()
        edited = card("alpha", "Alpha", "Free for verified students for six months.")
        report, updated, _ = scan(listing(edited, BETA, GAMMA), state)
        self.assertEqual(report["summary"]["changed"], 1)
        by_id = {item["id"]: item for item in report["sources"][0]["items"]}
        self.assertEqual(by_id["alpha"]["status"], "changed")
        self.assertEqual(by_id["gamma"]["status"], "new")
        self.assertTrue(by_id["gamma"]["unregistered_candidate"])
        self.assertNotEqual(updated["sources"][PACK]["content_hash"], state["sources"][PACK]["content_hash"])

    def test_navigation_description_and_whitespace_noise_do_not_change_offer_hash(self):
        _, state, _ = scan()
        changed_noise = listing(ALPHA, BETA).replace("<body>", "<body><nav>New navigation</nav>")
        changed_noise = changed_noise.replace("Product description", "Updated marketing copy")
        changed_noise = changed_noise.replace("Free for", "Free  \nfor")
        report, _, _ = scan(changed_noise, state)
        self.assertEqual(report["summary"]["unchanged"], 1)

    def test_missing_offer_is_unknown_and_old_complete_state_is_preserved(self):
        _, state, _ = scan(listing(ALPHA, BETA, GAMMA))
        report, updated, _ = scan(listing(ALPHA, BETA), state)
        source = report["sources"][0]
        self.assertEqual(source["status"], "unknown")
        self.assertEqual(source["error_code"], "listing_incomplete")
        self.assertEqual(report["summary"]["manual_required"], 1)
        self.assertEqual(report["summary"]["source_errors"], 0)
        self.assertEqual(source["items"][-1]["reason"], "missing_from_listing_not_confirmed_ended")
        self.assertEqual(updated["sources"], state["sources"])
        self.assertNotIn('"expired"', json.dumps(report))

    def test_parser_drift_partial_cards_and_challenges_cannot_advance_state(self):
        _, state, _ = scan()
        broken = [
            listing(ALPHA, BETA).replace("pack-offer-card", "new-card"),
            listing(ALPHA, BETA).replace("<h5>Offer</h5><p>", "<h5>Benefit</h5><p>"),
            listing(ALPHA, BETA).replace("<h3 id=", "<h2 id=").replace("</h3>", "</h2>"),
            listing(ALPHA, BETA).replace("</html>", ""),
            page("<main><h1>Verify you are human</h1></main>", "Just a moment..."),
            listing(ALPHA, BETA).replace("</body>", '<script src="/cdn-cgi/challenge-platform/run"></script></body>'),
            listing(ALPHA, ALPHA),
            listing(ALPHA, BETA).replace('id="beta"', 'id="javascript:alert(1)"'),
        ]
        for html in broken:
            with self.subTest(html=html[:120]):
                report, updated, _ = scan(html, state)
                self.assertEqual(report["summary"]["unknown"], 1)
                self.assertEqual(updated["sources"], state["sources"])

    def test_failed_source_does_not_clear_last_success_and_staleness_is_visible(self):
        _, state, _ = scan()
        state["sources"][PACK]["fetched_at"] = OLD
        report, updated = monitor.scan(catalog(), config(), state,
                                      FakeFetcher(monitor.MonitorError("robots_denied", "Blocked")), NOW)
        source = report["sources"][0]
        self.assertEqual(source["last_successful_fetch"], OLD)
        self.assertTrue(source["stale"])
        self.assertIsNone(source["fetched_at"])
        self.assertEqual(updated["sources"], state["sources"])

    def test_generic_adapter_hashes_only_main_content(self):
        content = "Free student plan includes 50 credits, one project and community support. " * 2
        first = page(f"<nav>Yesterday</nav><main><h1>Pricing</h1><p>{content}</p></main>")
        second = first.replace("Yesterday", "Today")
        source = {"url": "https://example.com/pricing"}
        extract = lambda value: monitor.extract_terms(monitor.source_document(response(value)), source)
        self.assertEqual(extract(first), extract(second))
        self.assertNotEqual(extract(first), extract(first.replace("50 credits", "20 credits")))
        with self.assertRaises(monitor.MonitorError):
            extract(page("<main><h1>Pricing</h1><p>Loading...</p></main>"))

    def test_nested_official_main_regions_are_supported_but_siblings_are_ambiguous(self):
        content = "Free student plan includes 50 credits, one project and community support. " * 2
        region = f"<main><h1>Pricing</h1><p>{content}</p></main>"
        source = {"url": "https://example.com/pricing"}
        document = monitor.source_document(response(page(f'<main role="main"><article>{region}</article></main>')))
        self.assertIn("page", monitor.extract_terms(document, source))
        document = monitor.source_document(response(page(region + region)))
        with self.assertRaises(monitor.MonitorError):
            monitor.extract_terms(document, source)

    def test_invalid_source_title_cannot_create_an_unreadable_next_state(self):
        report, state, _ = scan(listing(ALPHA, card("beta", "Beta\x00", "Free for students.")))
        self.assertEqual(report["summary"]["unknown"], 1)
        self.assertEqual(state["sources"], {})

    def test_url_injection_is_not_fetched(self):
        for url in ("http://education.github.com/pack", "https://evil.example/pack", "https://127.0.0.1/",
                    "https://education.github.com@127.0.0.1/", "https://education.github.com:8443/",
                    "https://education.github.com/\r\nHost:evil", "https://education.github.com/%0d%0a",
                    "https://education.github.com\\@127.0.0.1/"):
            with self.subTest(url=url), self.assertRaises(monitor.MonitorError):
                monitor.canonical_url(url, HOSTS)
        data = catalog()
        data["opportunities"][0]["source_url"] = "https://evil.example/"
        report, _, fetcher = scan(input_catalog=data)
        self.assertEqual(fetcher.calls, [PACK])
        self.assertEqual(report["summary"]["unknown"], 1)

    def test_dns_private_loopback_metadata_mixed_and_multicast_are_rejected(self):
        for address in ("127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1", "224.0.0.1"):
            result = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
                      (socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]
            with self.subTest(address=address), patch.object(socket, "getaddrinfo", return_value=result):
                with self.assertRaises(monitor.MonitorError) as error:
                    monitor.public_addresses("example.com")
                self.assertEqual(error.exception.code, "unsafe_address")

    def test_tls_connects_to_pinned_public_ip_and_checks_original_hostname(self):
        raw_socket = Mock()
        connection = monitor.PinnedHTTPSConnection("example.com", "8.8.8.8", 10)
        connection._context = Mock()
        with patch.object(socket, "create_connection", return_value=raw_socket) as connect:
            connection.connect()
        connect.assert_called_once_with(("8.8.8.8", 443), 10)
        connection._context.wrap_socket.assert_called_once_with(raw_socket, server_hostname="example.com")

    def test_state_validation_rejects_poisoned_schema_hash_url_and_future_dates(self):
        _, good, _ = scan()
        mutants = []
        for key, value in (("schema_version", True), ("parser_version", "unknown"), ("generated_at", "2030-01-01T00:00:00Z")):
            mutant = copy.deepcopy(good)
            mutant[key] = value
            mutants.append(mutant)
        mutant = copy.deepcopy(good)
        mutant["sources"][PACK]["items"]["alpha"]["source_url"] = "https://127.0.0.1/"
        mutants.append(mutant)
        mutant = copy.deepcopy(good)
        mutant["sources"][PACK]["content_hash"] = "0" * 64
        mutants.append(mutant)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            for mutant in mutants:
                path.write_text(json.dumps(mutant), encoding="utf-8")
                with self.subTest(mutant=mutant), self.assertRaises(monitor.MonitorError):
                    monitor.load_state(path, HOSTS, NOW)
            path.write_text(json.dumps(good), encoding="utf-8")
            self.assertEqual(monitor.load_state(path, HOSTS, NOW), good)

    def test_robots_wildcards_agent_precedence_delay_and_errors(self):
        robots = monitor.Robots("User-agent: *\nDisallow: /private*\nAllow: /private/public$\nCrawl-delay: 3")
        self.assertFalse(robots.allows("https://example.com/private-info"))
        self.assertTrue(robots.allows("https://example.com/private/public"))
        self.assertFalse(robots.allows("https://example.com/private/public?x=y"))
        self.assertEqual(robots.delay, 3)
        robots = monitor.Robots("User-agent: *\nDisallow: /\nUser-agent: AIPerkRadarMonitor\nAllow: /pack\nRequest-rate: 1/10")
        self.assertTrue(robots.allows(PACK))
        self.assertEqual(robots.delay, 10)
        robots = monitor.Robots("User-agent: *\nDisallow: */confirmation/\nDisallow: */?s=*")
        self.assertFalse(robots.allows("https://example.com/events/confirmation/"))
        self.assertFalse(robots.allows("https://example.com/?s=pricing"))
        self.assertTrue(robots.allows("https://example.com/free/"))
        for text in ("<html>challenge</html>", "unparseable", "Disallow: /", "User-agent: *\nCrawl-delay: NaN"):
            with self.subTest(text=text), self.assertRaises(monitor.MonitorError):
                monitor.Robots(text)

    def test_robots_denial_error_and_unsafe_redirect_are_never_followed(self):
        for robots in (response("User-agent: *\nDisallow: /pack", url=PACK, media="text/plain"),
                       response("Unavailable", status=503, media="text/plain"),
                       response("<html>challenge</html>", media="text/html")):
            calls = []
            def request(url, *args, **kwargs):
                calls.append(url)
                return robots
            fetcher = monitor.SafeFetcher(HOSTS, request=request, sleep=lambda _: None)
            with self.subTest(robots=robots), self.assertRaises(monitor.MonitorError):
                fetcher.fetch(PACK)
            self.assertEqual(len(calls), 1)
        for location in ("https://127.0.0.1/", "http://education.github.com/pack", "https://example.com/pack"):
            calls = []
            def request(url, *args, **kwargs):
                calls.append(url)
                if url.endswith("robots.txt"):
                    return response("User-agent: *\nAllow: /", url=url, media="text/plain")
                return response("", 302, url=url, headers={"location": location})
            fetcher = monitor.SafeFetcher(HOSTS, request=request, sleep=lambda _: None)
            with self.subTest(location=location), self.assertRaises(monitor.MonitorError):
                fetcher.fetch(PACK)
            self.assertEqual(len(calls), 2)

    def test_same_host_redirect_rechecks_robots_and_respects_delay(self):
        calls, waits = [], []
        def request(url, *args, **kwargs):
            calls.append(url)
            if url.endswith("robots.txt"):
                return response("User-agent: *\nDisallow: /private\nCrawl-delay: 4", url=url, media="text/plain")
            return response("", 302, url=url, headers={"location": "/private"})
        fetcher = monitor.SafeFetcher(HOSTS, request=request, sleep=waits.append, clock=lambda: 0)
        with self.assertRaises(monitor.MonitorError) as error:
            fetcher.fetch(PACK)
        self.assertEqual(error.exception.code, "robots_denied")
        self.assertEqual(waits, [4])
        self.assertEqual(len(calls), 2)

    def test_http_size_truncation_and_encoding_fail_closed(self):
        cases = [
            ({"content-length": "9999999"}, [b""], "response_too_large"),
            ({"content-length": "20"}, [b"short", b""], "truncated"),
            ({"content-encoding": "gzip"}, [b"compressed"], "unsupported_encoding"),
            ({}, [b"x" * 33], "response_too_large"),
        ]
        for headers, chunks, expected in cases:
            connection = Mock()
            raw = connection.getresponse.return_value
            raw.getheaders.return_value = list(headers.items())
            raw.status = 200
            raw.read1.side_effect = chunks
            with self.subTest(expected=expected), \
                 patch.object(monitor, "public_addresses", return_value=["8.8.8.8"]), \
                 patch.object(monitor, "PinnedHTTPSConnection", return_value=connection):
                with self.assertRaises(monitor.MonitorError) as error:
                    monitor.https_request("https://example.com/", HOSTS, max_bytes=32)
                self.assertEqual(error.exception.code, expected)
                connection.close.assert_called_once()

    def test_rate_limit_and_http_errors_preserve_source_state(self):
        _, state, _ = scan()
        for status in (403, 404, 429, 500, 503):
            report, updated = monitor.scan(catalog(), config(), state,
                                          FakeFetcher(response("Unavailable", status)), NOW)
            with self.subTest(status=status):
                self.assertEqual(report["summary"]["unknown"], 1)
                self.assertEqual(report["summary"]["source_errors"], 1)
                self.assertEqual(report["summary"]["observed_sources"], 0)
                self.assertEqual(updated["sources"], state["sources"])

    def test_excessive_crawl_delay_and_run_budget_do_not_fetch_source(self):
        calls = []
        def request(url, *args, **kwargs):
            calls.append(url)
            return response("User-agent: *\nCrawl-delay: 300", url=url, media="text/plain")
        fetcher = monitor.SafeFetcher(HOSTS, request=request, sleep=lambda _: None, clock=lambda: 0)
        with self.assertRaises(monitor.MonitorError) as error:
            fetcher.fetch(PACK)
        self.assertEqual(error.exception.code, "scan_budget")
        self.assertEqual(len(calls), 1)
        fetcher = monitor.SafeFetcher(HOSTS, request=request, clock=lambda: 0, max_seconds=0)
        with self.assertRaises(monitor.MonitorError):
            fetcher.fetch(PACK)
        self.assertEqual(len(calls), 1)

    def test_invalid_state_and_output_overlap_never_overwrite_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text("protected", encoding="utf-8")
            self.assertEqual(monitor.main(["--catalog", str(path), "--output", str(path)]), 1)
            self.assertEqual(path.read_text(), "protected")


if __name__ == "__main__":
    unittest.main()
