"""Detect official-source changes without models or factual verification.

By default only hashes, short titles and official source links survive a scan.
Opt-in review reports include bounded, untrusted excerpts; state remains hash-only.
See docs/SOURCE_MONITOR.md for the report/state contract and crawl policy.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import http.client
import ipaddress
import json
import queue
import re
import socket
import ssl
import sys
import tempfile
import threading
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "executas/ai-perk-radar"))
from catalog_validation import parse_catalog

SCHEMA_VERSION = 1
PARSER_VERSION = "2026-09-20.1"
USER_AGENT = "AIPerkRadarMonitor/1.0 (+https://github.com/mooi218/ai-perk-radar)"
MAX_BODY = 2 * 1024 * 1024
MAX_JSON = 4 * 1024 * 1024
MAX_SOURCES = 120
MAX_ITEMS = 500
HASH = re.compile(r"[a-f0-9]{64}\Z")
ITEM_ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,99}\Z")
MEANING = "Source observations only; not verification of eligibility, availability, price or expiry."
MANUAL_REQUIRED = {"unsafe_url", "unsafe_redirect", "robots_denied", "unsupported_encoding",
                   "unexpected_content", "parser_drift", "challenge", "listing_incomplete"}


class MonitorError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def require(condition, code, message):
    if not condition:
        raise MonitorError(code, message)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def timestamp(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value),
            "invalid_state", "Invalid state timestamp")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise MonitorError("invalid_state", "Invalid state timestamp") from error


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).split())


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def canonical_url(value, allowed_hosts):
    require(isinstance(value, str) and 0 < len(value) <= 2048 and
            not re.search(r"[\s\\\x00-\x1f\x7f]", value), "unsafe_url", "Invalid source URL")
    try:
        parts = urlsplit(value)
        host = parts.hostname or ""
        require(parts.scheme == "https" and host in allowed_hosts and
                re.fullmatch(r"[a-z0-9.-]+", host) and
                not parts.username and not parts.password and parts.port in (None, 443),
                "unsafe_url", "Only explicitly allowlisted HTTPS hosts are allowed")
        require(not re.search(r"[\x00-\x1f\x7f\\]", unquote(parts.path + parts.query)),
                "unsafe_url", "Invalid encoded URL characters")
        # The listing uses both spellings in the catalog; they are one source.
        path = parts.path or "/"
        if host == "education.github.com" and path in ("/pack", "/pack/"):
            path = "/pack"
        return urlunsplit(("https", host, path, parts.query, ""))
    except ValueError as error:
        if isinstance(error, MonitorError):
            raise
        raise MonitorError("unsafe_url", "Invalid source URL authority") from error


def public_addresses(host, timeout=10):
    # A daemon resolver bounds DNS time without waiting for an abandoned worker.
    answers = queue.Queue(maxsize=1)

    def resolve():
        try:
            answers.put(socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM))
        except OSError as error:
            answers.put(error)

    threading.Thread(target=resolve, daemon=True).start()
    try:
        result = answers.get(timeout=timeout)
    except queue.Empty as error:
        raise MonitorError("dns_timeout", "DNS resolution timed out") from error
    if isinstance(result, Exception):
        raise MonitorError("dns_error", "DNS resolution failed")
    addresses = sorted({entry[4][0] for entry in result})
    require(bool(addresses), "dns_error", "DNS returned no addresses")
    for address in addresses:
        ip = ipaddress.ip_address(address)
        require(ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_unspecified),
                "unsafe_address", "DNS returned a non-public address")
    return addresses


@dataclass
class Response:
    status: int
    headers: dict
    body: bytes
    url: str
    fetched_at: str


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Pin the validated address while retaining TLS hostname verification/SNI."""
    def __init__(self, host, address, timeout):
        super().__init__(host, timeout=timeout, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        self.sock = socket.create_connection((self.address, 443), self.timeout)
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)


def https_request(url, allowed_hosts, timeout=20, max_bytes=MAX_BODY):
    url = canonical_url(url, allowed_hosts)
    parts = urlsplit(url)
    started = time.monotonic()
    addresses = public_addresses(parts.hostname, min(10, timeout))
    remaining = timeout - (time.monotonic() - started)
    require(remaining > 0, "timeout", "Request time budget exhausted")
    conn = PinnedHTTPSConnection(parts.hostname, addresses[0], remaining)

    def interrupt():
        active_socket = conn.sock
        if active_socket:
            try:
                active_socket.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            active_socket.close()

    timer = threading.Timer(remaining, interrupt)
    timer.daemon = True
    timer.start()
    try:
        conn.request("GET", urlunsplit(("", "", parts.path, parts.query, "")), headers={
            "Host": parts.hostname, "User-Agent": USER_AGENT,
            "Accept": "text/html, text/plain;q=0.9", "Accept-Encoding": "identity",
        })
        response = conn.getresponse()
        headers = {key.lower(): value for key, value in response.getheaders()}
        require(headers.get("content-encoding", "identity").lower() in ("", "identity"),
                "unsupported_encoding", "Compressed response was not requested")
        declared = headers.get("content-length")
        if declared is not None:
            require(declared.isdigit() and int(declared) <= max_bytes,
                    "response_too_large", "Response exceeds byte limit")
        chunks, size = [], 0
        while True:
            require(time.monotonic() - started < timeout, "timeout", "Request timed out")
            chunk = response.read1(min(65536, max_bytes + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
            require(size <= max_bytes, "response_too_large", "Response exceeds byte limit")
        require(declared is None or size == int(declared), "truncated", "Incomplete HTTP response")
        return Response(response.status, headers, b"".join(chunks), url, utc_now())
    except (OSError, http.client.HTTPException) as error:
        raise MonitorError("network_error", "TLS, network or incomplete-response error") from error
    finally:
        timer.cancel()
        conn.close()


def decode(response):
    media = response.headers.get("content-type", "").lower()
    charset = re.search(r"charset=[\"']?([a-z0-9_-]+)", media)
    require(not charset or charset.group(1) in ("utf-8", "utf8", "us-ascii"),
            "unsupported_encoding", "Only UTF-8 and ASCII sources are supported")
    try:
        return response.body.decode("utf-8-sig", errors="strict")
    except UnicodeError as error:
        raise MonitorError("invalid_encoding", "Invalid source encoding") from error


class Robots:
    """Small conservative robots parser, including wildcard/$ and crawl delays."""
    def __init__(self, text):
        require("<" not in text and len(text) <= 262144,
                "robots_unknown", "robots.txt is not a usable text policy")
        groups, agents, rules, delay, has_rules = [], [], [], 2.0, False
        for raw in text.splitlines() + ["User-agent: __end__"]:
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            require(":" in line, "robots_unknown", "Malformed robots.txt policy")
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if has_rules:
                    groups.append((agents, rules, delay))
                    agents, rules, delay, has_rules = [], [], 2.0, False
                agents.append(value.lower())
            elif key in ("allow", "disallow", "crawl-delay", "request-rate"):
                require(bool(agents), "robots_unknown", "robots.txt rule has no user agent")
                has_rules = True
                if key in ("allow", "disallow"):
                    if value:
                        require(value.startswith(("/", "*")), "robots_unknown", "Unsupported robots path")
                        rules.append((key == "allow", unquote(value)))
                elif key == "crawl-delay":
                    try:
                        value = float(value)
                        require(0 <= value <= 3600, "robots_unknown", "Unsupported crawl delay")
                        delay = max(delay, value)
                    except ValueError as error:
                        raise MonitorError("robots_unknown", "Invalid crawl delay") from error
                else:
                    rate = re.fullmatch(r"([1-9]\d*)/([1-9]\d*)", value)
                    require(rate is not None, "robots_unknown", "Unsupported request-rate")
                    delay = max(delay, int(rate[2]) / int(rate[1]))
        product = "aiperkradarmonitor"
        scores = [(max((len(a) if a != "*" else 0 for a in group[0]
                        if a == "*" or a in product), default=-1), group) for group in groups]
        best = max((score for score, _ in scores), default=-1)
        matching = [group for score, group in scores if score == best and score >= 0]
        self.rules = [rule for group in matching for rule in group[1]]
        self.delay = max([2.0] + [group[2] for group in matching])

    def allows(self, url):
        parsed = urlsplit(url)
        path = unquote(parsed.path + ("?" + parsed.query if parsed.query else ""))
        matches = []
        for allow, rule in self.rules:
            anchored = rule.endswith("$")
            pattern = rule[:-1] if anchored else rule
            regex = "^" + re.escape(pattern).replace(r"\*", ".*") + ("$" if anchored else "")
            if re.search(regex, path):
                matches.append((len(pattern.replace("*", "")), allow))
        return max(matches, default=(0, True))[1]


class SafeFetcher:
    def __init__(self, allowed_hosts, *, request=https_request, clock=time.monotonic,
                 sleep=time.sleep, max_seconds=480):
        self.allowed_hosts, self.request = allowed_hosts, request
        self.clock, self.sleep = clock, sleep
        self.deadline = clock() + max_seconds
        self.policies, self.last_request = {}, {}
        self.request_attempts, self.response_bytes = 0, 0

    def _request(self, url, delay=2, max_bytes=MAX_BODY):
        host = urlsplit(url).hostname
        wait = max(0, self.last_request.get(host, -float("inf")) + delay - self.clock())
        require(wait <= 30 and self.clock() + wait + 1 < self.deadline,
                "scan_budget", "Crawl delay or scan time budget requires a later run")
        if wait:
            self.sleep(wait)
        self.last_request[host] = self.clock()
        self.request_attempts += 1
        response = self.request(url, self.allowed_hosts, timeout=min(20, self.deadline - self.clock()),
                                max_bytes=max_bytes)
        self.response_bytes += len(response.body)
        return response

    def policy(self, host):
        if host not in self.policies:
            try:
                url = f"https://{host}/robots.txt"
                for _ in range(4):
                    response = self._request(url, max_bytes=262144)
                    if response.status not in (301, 302, 303, 307, 308):
                        break
                    url = self._redirect(response, host)
                else:
                    raise MonitorError("robots_unknown", "Too many robots.txt redirects")
                if response.status == 404:
                    policy = Robots("")
                else:
                    require(response.status == 200, "robots_unknown", "robots.txt could not be checked")
                    require(response.headers.get("content-type", "").lower().startswith("text/plain"),
                            "robots_unknown", "robots.txt did not return text/plain")
                    policy = Robots(decode(response))
                self.policies[host] = policy
            except MonitorError as error:
                self.policies[host] = error
        policy = self.policies[host]
        if isinstance(policy, MonitorError):
            raise policy
        return policy

    def _redirect(self, response, original_host):
        location = response.headers.get("location", "")
        require(location, "unsafe_redirect", "Redirect has no destination")
        url = canonical_url(urljoin(response.url, location), self.allowed_hosts)
        require(urlsplit(url).hostname == original_host,
                "unsafe_redirect", "Cross-host redirects require source review")
        return url

    def fetch(self, url):
        url = canonical_url(url, self.allowed_hosts)
        host = urlsplit(url).hostname
        policy = self.policy(host)
        for _ in range(4):
            require(policy.allows(url), "robots_denied", "Source disallows this crawler")
            response = self._request(url, policy.delay)
            if response.status not in (301, 302, 303, 307, 308):
                return response
            url = self._redirect(response, host)
        raise MonitorError("unsafe_redirect", "Too many source redirects")


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    closed: bool = False

    def nodes(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.nodes()

    def text(self):
        if self.tag in {"script", "style", "noscript", "nav", "footer", "aside", "button", "svg"}:
            return ""
        return normalized(" ".join(child.text() if isinstance(child, Node) else child
                                   for child in self.children))


class Document(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root, self.count = Node("document"), 0
        self.stack = [self.root]
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        self.count += 1
        require(self.count <= 60000 and len(self.stack) <= 128, "parser_limit", "HTML structure limit exceeded")
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag in self.VOID:
            node.closed = True
        else:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack[index].closed = True
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def source_document(response):
    require(response.status == 200, "http_error", f"Source returned HTTP {response.status}")
    require(response.headers.get("content-type", "").lower().split(";", 1)[0].strip()
            in ("text/html", "application/xhtml+xml"), "unexpected_content", "Source did not return HTML")
    html = decode(response)
    require(re.search(r"</body\s*>", html, re.I) and re.search(r"</html\s*>\s*$", html, re.I),
            "truncated", "HTML has no complete document ending")
    document = Document(html)
    titles = [node.text().lower() for node in document.root.nodes() if node.tag in ("title", "h1")]
    challenge = r"just a moment|access denied|verify (?:you|that)|checking your browser|attention required|captcha|page not found|404 not found|service unavailable"
    require(not any(re.search(challenge, title) for title in titles) and
            not re.search(r"cf-chl-|challenge-platform|id=[\"']challenge-form", html, re.I),
            "challenge", "Source returned an error or browser challenge")
    return document


def extract_pack(document, source):
    cards = [node for node in document.root.nodes()
             if "pack-offer-card" in (node.attrs.get("class") or "").split()]
    require(source.get("min_items", 30) <= len(cards) <= MAX_ITEMS,
            "parser_drift", "Offer-card count is outside the reviewed range")
    items = {}
    for card in cards:
        headings = [node for node in card.nodes() if node.tag == "h3"]
        require(card.closed and len(headings) == 1, "parser_drift", "Incomplete offer card")
        heading = headings[0]
        item_id, title = heading.attrs.get("id", ""), heading.text()
        require(ITEM_ID.fullmatch(item_id) and item_id not in items and 0 < len(title) <= 120
                and not re.search(r"[\x00-\x1f\x7f\ufffd]", title),
                "parser_drift", "Offer identity is missing, duplicated or unsafe")
        require(any(node.tag == "h4" and node.text() == "Offers" for node in card.nodes()),
                "parser_drift", "Expected offer section is missing")
        offers = []
        for section in card.nodes():
            children = [child for child in section.children if isinstance(child, Node)]
            if any(child.tag == "h5" and child.text().startswith("Offer") for child in children):
                paragraphs = [child.text() for child in children if child.tag == "p"]
                require(section.closed and paragraphs and all(paragraphs),
                        "parser_drift", "Offer terms are missing")
                offers.extend(paragraphs)
        require(offers and sum(map(len, offers)) <= 12000, "parser_drift", "Unsupported offer terms")
        items[item_id] = {"title": title, "hash": digest([title, offers]),
                          "source_url": source["url"] + "#" + item_id}
    return items


def extract_terms(document, source):
    nodes = list(document.root.nodes())
    mains = [node for node in nodes if node.tag == "main" or node.attrs.get("role") == "main"]
    if not mains:
        mains = [node for node in nodes if node.tag == "article"]
    # Some official docs nest a content <main> inside the site's outer <main>.
    # They are one region; independent sibling regions remain ambiguous.
    nested = {id(child) for node in mains for child in node.nodes()}
    mains = [node for node in mains if id(node) not in nested]
    require(len(mains) == 1 and mains[0].closed, "parser_drift", "A single intact main/article region is required")
    main = mains[0]
    headings = [node.text() for node in main.nodes() if node.tag == "h1" and node.text()]
    require(bool(headings) and not re.search(r"[\x00-\x1f\x7f\ufffd]", headings[0]),
            "parser_drift", "Source heading is missing or invalid")
    text = main.text()
    require(100 <= len(text) <= 120000 and
            re.search(r"free|student|educat|pricing|quota|limit|credit|research|scientist|無料|学生|料金", text, re.I),
            "parser_drift", "Relevant source content is missing or outside size limits")
    return {"page": {"title": headings[0][:120], "hash": digest(text), "source_url": source["url"]}}


def review_excerpts(document, adapter):
    """Bounded, untrusted excerpts for human review; never factual extraction."""
    if adapter == "github_pack":
        result = {}
        for card in document.root.nodes():
            if "pack-offer-card" not in (card.attrs.get("class") or "").split():
                continue
            heading = next(node for node in card.nodes() if node.tag == "h3")
            paragraphs = []
            for section in card.nodes():
                children = [child for child in section.children if isinstance(child, Node)]
                if any(child.tag == "h5" and child.text().startswith("Offer") for child in children):
                    paragraphs.extend(child.text() for child in children if child.tag == "p")
            result[heading.attrs["id"]] = normalized(" ".join(paragraphs))
        return result
    mains = [node for node in document.root.nodes()
             if node.tag == "main" or node.attrs.get("role") == "main"]
    if not mains:
        mains = [node for node in document.root.nodes() if node.tag == "article"]
    return {"page": mains[0].text()}


def read_json(path):
    require(path.stat().st_size <= MAX_JSON, "invalid_json", "JSON file exceeds size limit")

    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, "invalid_json", "Duplicate JSON property")
            value[key] = item
        return value

    def reject(_):
        raise MonitorError("invalid_json", "Non-finite JSON number")

    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique, parse_constant=reject)
    except (ValueError, RecursionError) as error:
        if isinstance(error, MonitorError):
            raise
        raise MonitorError("invalid_json", "Invalid JSON input") from error


def load_config(path):
    config = read_json(path)
    require(isinstance(config, dict) and set(config) == {"schema_version", "allowed_hosts", "discovery"}
            and type(config["schema_version"]) is int and config["schema_version"] == 1,
            "invalid_config", "Unsupported source configuration")
    hosts = config["allowed_hosts"]
    require(isinstance(hosts, list) and 0 < len(hosts) <= MAX_SOURCES and
            all(isinstance(host, str) and re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,}", host)
                and not host.endswith((".local", ".internal", ".localhost")) for host in hosts),
            "invalid_config", "Invalid host allowlist")
    require(isinstance(config["discovery"], list) and len(config["discovery"]) <= 10,
            "invalid_config", "Invalid discovery source list")
    seen = set()
    for source in config["discovery"]:
        require(isinstance(source, dict) and set(source) == {"url", "adapter", "min_items", "catalog_ids"},
                "invalid_config", "Invalid discovery source")
        url = canonical_url(source["url"], hosts)
        require(url == source["url"] and url not in seen and source["adapter"] == "github_pack"
                and url == "https://education.github.com/pack" and type(source["min_items"]) is int
                and 1 <= source["min_items"] <= MAX_ITEMS and isinstance(source["catalog_ids"], dict),
                "invalid_config", "Unsupported discovery adapter configuration")
        seen.add(url)
        for key, ids in source["catalog_ids"].items():
            require(ITEM_ID.fullmatch(key) and isinstance(ids, list) and
                    all(isinstance(item, str) and ITEM_ID.fullmatch(item) for item in ids),
                    "invalid_config", "Invalid catalog association")
    return config


def load_state(path, allowed_hosts, now):
    if not path.exists():
        return {"schema_version": 1, "parser_version": PARSER_VERSION, "generated_at": now, "sources": {}}
    state = read_json(path)
    require(isinstance(state, dict) and set(state) == {"schema_version", "parser_version", "generated_at", "sources"}
            and type(state["schema_version"]) is int and state["schema_version"] == 1
            and state["parser_version"] == PARSER_VERSION and isinstance(state["sources"], dict)
            and len(state["sources"]) <= MAX_SOURCES,
            "invalid_state", "Unsupported state schema/parser; preserve it and start an explicit new baseline")
    require(timestamp(state["generated_at"]) <= timestamp(now), "invalid_state", "Future state timestamp")
    for url, snapshot in state["sources"].items():
        require(canonical_url(url, allowed_hosts) == url and isinstance(snapshot, dict)
                and set(snapshot) == {"adapter", "fetched_at", "content_hash", "items"}
                and snapshot["adapter"] in ("github_pack", "terms")
                and isinstance(snapshot["content_hash"], str) and HASH.fullmatch(snapshot["content_hash"])
                and isinstance(snapshot["items"], dict) and 0 < len(snapshot["items"]) <= MAX_ITEMS,
                "invalid_state", "Invalid source snapshot")
        require(timestamp(snapshot["fetched_at"]) <= timestamp(state["generated_at"]),
                "invalid_state", "Invalid snapshot chronology")
        for item_id, item in snapshot["items"].items():
            require(ITEM_ID.fullmatch(item_id) and isinstance(item, dict) and set(item) == {"title", "hash", "source_url"}
                    and isinstance(item["title"], str) and 0 < len(item["title"]) <= 120
                    and not re.search(r"[\x00-\x1f\x7f]", item["title"])
                    and isinstance(item["hash"], str) and HASH.fullmatch(item["hash"])
                    and canonical_url(item["source_url"], allowed_hosts) == url,
                    "invalid_state", "Invalid snapshot item")
            expected = url + "#" + item_id if snapshot["adapter"] == "github_pack" else url
            require(item["source_url"] == expected, "invalid_state", "Unsafe source fragment")
        require(snapshot["content_hash"] == digest(snapshot["items"]), "invalid_state", "State integrity mismatch")
    return state


def scan(catalog, config, state, fetcher, now, *, include_review_excerpts=False):
    sources, rejected = {}, []
    for perk in catalog["opportunities"]:
        try:
            url = canonical_url(perk["source_url"], config["allowed_hosts"])
            source = sources.setdefault(url, {"url": url, "adapter": "terms", "catalog_ids": []})
            source["catalog_ids"].append(perk["id"])
        except MonitorError as error:
            rejected.append({"catalog_ids": [perk["id"]], "status": "unknown", "error_code": error.code,
                             "message": str(error), "fetched_at": None, "previous_baseline": None,
                             "last_successful_fetch": None, "stale": True, "items": [],
                             "coverage_gap": "manual_required"})
    for discovery in config["discovery"]:
        prior_ids = sources.get(discovery["url"], {}).get("catalog_ids", [])
        sources[discovery["url"]] = {**discovery, "source_catalog_ids": prior_ids}
    require(len(sources) <= MAX_SOURCES, "source_limit", "Source count exceeds reviewed crawl limit")
    next_state = copy.deepcopy(state)
    next_state["generated_at"] = now
    reports = rejected
    catalog_ids = {perk["id"] for perk in catalog["opportunities"]}
    # Discovery first so a slow provider cannot consume the discovery budget.
    ordered = sorted(sources.values(), key=lambda s: (s["adapter"] != "github_pack", s["url"]))
    for source in ordered:
        url, adapter = source["url"], source["adapter"]
        prior = state["sources"].get(url)
        old_time = prior["fetched_at"] if prior else None
        report = {"source_url": url, "adapter": adapter,
                  "catalog_ids": source.get("source_catalog_ids", source["catalog_ids"]),
                  "status": "unknown", "fetched_at": None, "previous_baseline": old_time,
                  "previous_content_hash": prior["content_hash"] if prior else None,
                  "last_successful_fetch": old_time,
                  "stale": not old_time or (timestamp(now) - timestamp(old_time)).total_seconds() > 86400,
                  "items": []}
        reports.append(report)
        try:
            response = fetcher.fetch(url)
            report["fetched_at"] = response.fetched_at
            report["resolved_url"] = response.url
            document = source_document(response)
            items = extract_pack(document, source) if adapter == "github_pack" else extract_terms(document, source)
            require(not prior or prior["adapter"] == adapter, "parser_drift", "Adapter changed; start an explicit new baseline")
            previous_items = prior["items"] if prior else {}
            for item_id, item in sorted(items.items()):
                previous = previous_items.get(item_id)
                status = "baseline" if not prior else "new" if not previous else "unchanged" if previous["hash"] == item["hash"] else "changed"
                associated = source["catalog_ids"].get(item_id, []) if adapter == "github_pack" else source["catalog_ids"]
                associated = sorted(set(associated) & catalog_ids)
                # Include unregistered candidates on the initial run, explicitly
                # without claiming they were newly announced.
                if status != "unchanged" or adapter == "github_pack" and not associated:
                    report["items"].append({"id": item_id, "title": item["title"], "source_url": item["source_url"],
                                            "status": status, "catalog_ids": associated,
                                            "content_hash": item["hash"],
                                            "previous_content_hash": previous["hash"] if previous else None,
                                            "unregistered_candidate": adapter == "github_pack" and not associated})
            missing = sorted(previous_items.keys() - items.keys())
            for item_id in missing:
                report["items"].append({"id": item_id, "title": previous_items[item_id]["title"],
                                        "source_url": previous_items[item_id]["source_url"], "status": "unknown",
                                        "reason": "missing_from_listing_not_confirmed_ended"})
            # An omitted card may be server-side partial rendering. Keep the
            # last complete baseline until its absence is independently reviewed.
            require(not missing, "listing_incomplete", "Previously seen offers are absent; availability is unknown")
            if include_review_excerpts:
                excerpts = review_excerpts(document, adapter)
                for item in report["items"]:
                    text = excerpts[item["id"]]
                    item["evidence_excerpt"] = text[:600]
                    item["excerpt_truncated"] = len(text) > 600
            content_hash = digest(items)
            report["content_hash"] = content_hash
            report["status"] = "baseline" if not prior else "unchanged" if content_hash == prior["content_hash"] else "changed"
            report["observed_items"] = len(items)
            report["last_successful_fetch"], report["stale"] = response.fetched_at, False
            next_state["sources"][url] = {"adapter": adapter, "fetched_at": response.fetched_at,
                                         "content_hash": content_hash, "items": items}
        except MonitorError as error:
            report.update(status="unknown", error_code=error.code, message=str(error),
                          coverage_gap="manual_required" if error.code in MANUAL_REQUIRED else "source_error")
    next_state["sources"] = {url: snapshot for url, snapshot in next_state["sources"].items() if url in sources}
    summary = {status: sum(source["status"] == status for source in reports)
               for status in ("baseline", "unchanged", "changed", "unknown")}
    summary.update(observed_sources=sum(source["status"] != "unknown" for source in reports),
                   manual_required=sum(source.get("coverage_gap") == "manual_required" for source in reports),
                   source_errors=sum(source.get("coverage_gap") == "source_error" for source in reports),
                   stale_sources=sum(source["stale"] for source in reports),
                   unregistered_candidates=sum(item.get("unregistered_candidate", False)
                                               for source in reports for item in source["items"]))
    report = {"schema_version": 1, "parser_version": PARSER_VERSION, "generated_at": now,
              "catalog_revision": catalog["revision"], "semantics": MEANING,
              "baseline_status": "initial" if not state["sources"] else "previous_state",
              "previous_run_at": state["generated_at"] if state["sources"] else None,
              "summary": summary, "sources": reports}
    return report, next_state


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     prefix="." + path.name + ".", suffix=".tmp", delete=False) as output:
        temporary = Path(output.name)
        output.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    try:
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "executas/ai-perk-radar/ai_perk_radar/opportunities.json")
    parser.add_argument("--sources", type=Path, default=ROOT / "monitoring/sources.json")
    parser.add_argument("--state", type=Path, default=ROOT / ".source-monitor/state.json")
    parser.add_argument("--output", type=Path, default=ROOT / ".source-monitor/report.json")
    parser.add_argument("--state-output", type=Path, default=ROOT / ".source-monitor/state.json")
    parser.add_argument("--include-review-excerpts", action="store_true",
                        help="Save at most 600 characters of untrusted source text per review item")
    args = parser.parse_args(argv)
    now = utc_now()
    try:
        # Prevent a mistyped output path from overwriting source data or inputs.
        protected = {args.catalog.resolve(), args.sources.resolve(), Path(__file__).resolve()}
        require(args.output.resolve() not in protected and args.state_output.resolve() not in protected
                and args.output.resolve() != args.state_output.resolve()
                and args.output.resolve() != args.state.resolve(),
                "unsafe_output", "Report/state output paths overlap protected inputs")
        config = load_config(args.sources)
        catalog, _ = parse_catalog(args.catalog.read_text(encoding="utf-8"))
        state = load_state(args.state, config["allowed_hosts"], now)
        started = time.monotonic()
        fetcher = SafeFetcher(config["allowed_hosts"])
        report, next_state = scan(catalog, config, state, fetcher, now,
                                  include_review_excerpts=args.include_review_excerpts)
        next_state["generated_at"] = utc_now()
        report["completed_at"] = next_state["generated_at"]
        report["metrics"] = {"elapsed_seconds": round(time.monotonic() - started, 3),
                             "request_attempts": fetcher.request_attempts,
                             "response_bytes": fetcher.response_bytes}
        write_json(args.output, report)
        write_json(args.state_output, next_state)
        print(json.dumps(report["summary"], sort_keys=True))
        if not report["summary"]["observed_sources"]:
            return 3
        return 2 if report["summary"]["unknown"] else 0
    except (MonitorError, ValueError, OSError) as error:
        # Invalid state is never silently discarded or overwritten.
        print(f"Source monitor failed: {getattr(error, 'code', 'input_error')}: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
