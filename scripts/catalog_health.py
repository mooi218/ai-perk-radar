"""Report maintenance work without treating a successful download as verification."""
import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXECUTA = ROOT / "executas/ai-perk-radar"
sys.path.insert(0, str(EXECUTA))
from catalog_validation import CATALOG_PATH, parse_catalog


def health_report(catalog, today):
    expired, due, uncertain, missing_ja = [], [], [], []
    for perk in catalog["opportunities"]:
        deadline = date.fromisoformat(perk["deadline"]) if perk["deadline"] else None
        if perk["availability"] == "expired" or deadline and deadline < today:
            expired.append(perk["id"])
            continue
        announced = date.fromisoformat(perk["announced"]) if perk["announced"] else None
        cadence = 7 if deadline or announced and (today - announced).days <= 30 else 30
        age = (today - date.fromisoformat(perk["last_checked"])).days
        if age > cadence:
            due.append({"id": perk["id"], "days_since_check": age, "cadence_days": cadence, "source": perk["source_url"]})
        if perk["availability"] == "check":
            uncertain.append(perk["id"])
        if not perk.get("localizations", {}).get("ja", {}).get("reason"):
            missing_ja.append(perk["id"])
    return {"revision": catalog["revision"], "as_of": today.isoformat(), "total": len(catalog["opportunities"]),
            "expired": expired, "verification_due": due, "check_availability": uncertain, "missing_japanese": missing_ja}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    args = parser.parse_args()
    catalog, _ = parse_catalog((EXECUTA / CATALOG_PATH).read_text(encoding="utf-8"))
    print(json.dumps(health_report(catalog, args.date), indent=2, ensure_ascii=True))
