"""Strict, data-only catalog boundary shared by the matcher and catalog checks."""

import hashlib
import json
import re
from datetime import date, datetime, timezone
from urllib.parse import urlsplit

MAX_CATALOG_BYTES = 256 * 1024
MAX_OPPORTUNITIES = 250
CATALOG_PATH = "ai_perk_radar/opportunities.json"
REQUIRED_FIELDS = {
    "id", "title", "provider", "regions", "student_required", "researcher_required",
    "interests", "free", "value_score", "value_display", "deadline", "announced",
    "verified_at", "source_url", "reason", "last_checked", "source_quality",
    "availability", "caution", "parent_id", "offer_type",
}
INTERESTS = {"ai", "coding", "cloud", "research", "creator"}
OFFER_TYPES = {"student_perk", "research_perk", "free_tier", "bundle", "other"}


class CatalogError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise CatalogError(message)


def plain_text(value, limit, *, empty=False):
    require(isinstance(value, str), "Catalog text must be a string")
    require((empty or bool(value.strip())) and len(value) <= limit, "Invalid catalog text length")
    require(not re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd\ufeff]", value), "Invalid catalog text encoding")
    # Unpaired surrogates cannot be displayed or encoded as UTF-8 safely.
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeError as error:
        raise CatalogError("Invalid catalog text encoding") from error
    return value


def catalog_date(value, *, optional=False):
    if optional and value is None:
        return None
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value), "Invalid catalog date")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise CatalogError("Invalid catalog date") from error


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON property")
        result[key] = value
    return result


def reject_constant(value):
    raise CatalogError("Non-finite JSON number")


def safe_source_url(value):
    plain_text(value, 2048)
    require(not re.search(r"[\s\\]", value), "Invalid source URL")
    try:
        url = urlsplit(value)
        require(url.scheme == "https" and url.hostname and "." in url.hostname, "Source URL must use public HTTPS")
        require(not url.username and not url.password and url.port in (None, 443), "Invalid source URL authority")
        require(re.fullmatch(r"[A-Za-z0-9.-]+", url.hostname) and not url.hostname.replace(".", "").isdigit(), "Invalid source host")
        require(not url.hostname.endswith((".localhost", ".local", ".internal")), "Invalid source host")
    except ValueError as error:
        raise CatalogError("Invalid source URL") from error


def validate_perk(perk, today):
    require(isinstance(perk, dict), "Opportunity must be an object")
    require(REQUIRED_FIELDS <= perk.keys() <= REQUIRED_FIELDS | {"localizations"}, "Unknown or missing opportunity fields")
    require(isinstance(perk["id"], str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", perk["id"]), "Invalid opportunity ID")
    for field in ("title", "provider", "value_display"):
        plain_text(perk[field], 300)
    plain_text(perk["reason"], 3000)
    plain_text(perk["caution"], 2000, empty=True)
    for field in ("student_required", "researcher_required", "free"):
        require(type(perk[field]) is bool, "Eligibility must be boolean")
    require(type(perk["value_score"]) is int and 0 <= perk["value_score"] <= 100, "Invalid value score")
    for field, allowed in (("regions", {"GLOBAL", "JP", "OTHER"}), ("interests", INTERESTS)):
        values = perk[field]
        require(isinstance(values, list) and 1 <= len(values) <= len(allowed), "Invalid catalog list")
        require(all(isinstance(value, str) and value in allowed for value in values), "Unsupported catalog list value")
        require(len(values) == len(set(values)), "Duplicate catalog list value")
    require(perk["availability"] in ("active", "check", "expired"), "Invalid availability")
    require(isinstance(perk["offer_type"], str) and perk["offer_type"] in OFFER_TYPES, "Invalid offer type")
    require(perk["source_quality"] == "official", "Only official-source entries are supported")
    verified = catalog_date(perk["verified_at"])
    checked = catalog_date(perk["last_checked"])
    require(verified <= checked <= today, "Invalid verification chronology")
    catalog_date(perk["deadline"], optional=True)
    announced = catalog_date(perk["announced"], optional=True)
    require(announced is None or announced <= today, "Future announcement date")
    parent = perk["parent_id"]
    require(parent is None or isinstance(parent, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", parent), "Invalid parent ID")
    safe_source_url(perk["source_url"])
    localizations = perk.get("localizations", {})
    require(isinstance(localizations, dict) and localizations.keys() <= {"ja"}, "Unsupported localization")
    for translation in localizations.values():
        require(isinstance(translation, dict) and translation.keys() <= {"value_display", "reason", "caution"}, "Invalid translation fields")
        for field, text in translation.items():
            plain_text(text, 300 if field == "value_display" else 3000, empty=field == "caution")


def parse_catalog(raw, *, today=None):
    today = today or datetime.now(timezone.utc).date()
    require(isinstance(raw, str), "A current catalog must be provided")
    try:
        size = len(raw.encode("utf-8", errors="strict"))
    except UnicodeError as error:
        raise CatalogError("Invalid catalog encoding") from error
    require(0 < size <= MAX_CATALOG_BYTES and not raw.startswith("\ufeff"), "Invalid catalog size or encoding")
    try:
        catalog = json.loads(raw, object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (ValueError, RecursionError) as error:
        raise CatalogError("Invalid catalog JSON") from error
    require(isinstance(catalog, dict) and set(catalog) == {"schema_version", "revision", "published_at", "opportunities"}, "Invalid catalog envelope")
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1, "Unsupported catalog schema")
    revision = plain_text(catalog["revision"], 60)
    require(re.fullmatch(r"[A-Za-z0-9._-]+", revision), "Invalid catalog revision")
    published_at = catalog["published_at"]
    require(isinstance(published_at, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", published_at), "Invalid publication timestamp")
    try:
        published = datetime.strptime(published_at, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as error:
        raise CatalogError("Invalid publication timestamp") from error
    require(published.date() <= today, "Future publication timestamp")
    perks = catalog["opportunities"]
    require(isinstance(perks, list) and len(perks) <= MAX_OPPORTUNITIES, "Invalid catalog count")
    ids = set()
    for perk in perks:
        validate_perk(perk, today)
        require(perk["id"] not in ids, "Duplicate opportunity ID")
        ids.add(perk["id"])
    for perk in perks:
        require(perk["parent_id"] is None or perk["parent_id"] in ids and perk["parent_id"] != perk["id"], "Unknown or self-referencing parent")
    return catalog, hashlib.sha256(raw.encode("utf-8")).hexdigest()
