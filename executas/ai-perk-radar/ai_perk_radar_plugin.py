"""Opportunity matching engine for AI Perk Radar."""

import json
import sys
from datetime import date, datetime
from pathlib import Path


MANIFEST = {
    "name": "tool-dev-ai-perk-radar",
    "version": "0.3.0",
    "tools": [
        {
            "name": "find_perks",
            "description": "Rank verified current AI, developer, student, and research perks for a user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "country": {
                        "type": "string",
                        "enum": ["JP", "OTHER"],
                    },
                    "student": {"type": "boolean"},
                    "researcher": {"type": "boolean"},
                    "developer": {"type": "boolean"},
                    "creator": {"type": "boolean"},
                    "founder": {"type": "boolean"},
                    "limited_only": {"type": "boolean"},
                    "priority": {
                        "type": "string",
                        "enum": ["free", "value", "deadline"],
                    },
                    "interests": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": [
                                "ai",
                                "coding",
                                "cloud",
                                "research",
                                "creator",
                            ],
                        },
                    },
                },
                "required": [
                    "country",
                    "student",
                    "researcher",
                    "developer",
                    "creator",
                    "founder",
                    "limited_only",
                    "priority",
                    "interests",
                ],
                "additionalProperties": False,
            },
        }
    ],
}


DATA_PATH = (
    Path(__file__).resolve().parent
    / "ai_perk_radar"
    / "opportunities.json"
)


def load_perks():
    with DATA_PATH.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def parse_date(value):
    if not value:
        return None

    return datetime.strptime(
        value,
        "%Y-%m-%d",
    ).date()


def region_matches(perk, country):
    regions = perk["regions"]

    return (
        "GLOBAL" in regions
        or country in regions
    )


def is_expired(perk):
    deadline = parse_date(
        perk.get("deadline")
    )

    if deadline is None:
        return False

    return deadline < date.today()


def freshness_label(announced):
    announced_date = parse_date(
        announced
    )

    if announced_date is None:
        return "Current"

    days = (
        date.today()
        - announced_date
    ).days

    if days <= 7:
        return "Just launched"

    if days <= 30:
        return "New"

    if days <= 180:
        return "Recent"

    return "Established"


def deadline_label(deadline):
    if not deadline:
        return "No fixed date"

    return parse_date(
        deadline
    ).strftime("%b %d, %Y")


def score_perk(perk, profile):
    if is_expired(perk):
        return None

    if (
        profile.get("limited_only")
        and not perk.get("deadline")
    ):
        return None

    if not region_matches(
        perk,
        profile["country"],
    ):
        return None

    if (
        perk["student_required"]
        and not profile["student"]
    ):
        return None

    if (
        perk["researcher_required"]
        and not profile["researcher"]
    ):
        return None

    score = 35
    reasons = []

    perk_interests = set(perk.get("interests", []))

    if profile.get("developer") and (
        "coding" in perk_interests
        or "cloud" in perk_interests
    ):
        score += 8
        reasons.append("developer fit")

    if profile.get("creator") and (
        "creator" in perk_interests
        or "ai" in perk_interests
    ):
        score += 8
        reasons.append("creator fit")

    if profile.get("founder") and (
        "ai" in perk_interests
        or "cloud" in perk_interests
        or "coding" in perk_interests
    ):
        score += 7
        reasons.append("builder fit")

    interests = set(
        profile.get("interests", [])
    )

    matching_interests = (
        interests.intersection(
            perk["interests"]
        )
    )

    score += min(
        24,
        len(matching_interests) * 9,
    )

    if matching_interests:
        reasons.append(
            "matches "
            + ", ".join(
                sorted(
                    matching_interests
                )
            )
        )

    if (
        profile["student"]
        and perk["student_required"]
    ):
        score += 18
        reasons.append(
            "student eligibility"
        )

    if (
        profile["researcher"]
        and perk["researcher_required"]
    ):
        score += 18
        reasons.append(
            "research eligibility"
        )

    priority = profile["priority"]

    if (
        priority == "free"
        and perk["free"]
    ):
        score += 18
        reasons.append(
            "no-cost offer"
        )

    if priority == "value":
        score += round(
            perk["value_score"] * 0.22
        )
        reasons.append(
            "high estimated value"
        )

    if priority == "deadline":
        deadline = parse_date(
            perk.get("deadline")
        )

        if deadline:
            remaining = (
                deadline
                - date.today()
            ).days

            if remaining <= 30:
                score += 25
            elif remaining <= 90:
                score += 18
            else:
                score += 8

            reasons.append(
                "time-limited"
            )

    announced = parse_date(
        perk.get("announced")
    )

    if announced:
        age = (
            date.today()
            - announced
        ).days

        if age <= 14:
            score += 10
        elif age <= 45:
            score += 6

    if perk.get("parent_id") == "github-student-developer-pack":
        score -= 12
        reasons.append("included in GitHub Student Developer Pack")

    score = max(
        1,
        min(99, score),
    )

    if reasons:
        why_prefix = (
            "Strong fit because of "
            + ", ".join(reasons)
            + ". "
        )
    else:
        why_prefix = ""

    return {
        "id": perk["id"],
        "title": perk["title"],
        "provider": perk["provider"],
        "match_score": score,
        "value_display": (
            perk["value_display"]
        ),
        "deadline_display": (
            deadline_label(
                perk.get("deadline")
            )
        ),
        "deadline_raw": perk.get("deadline"),
        "freshness": (
            freshness_label(
                perk.get("announced")
            )
        ),
        "verified_at": (
            perk.get("verified_at")
        ),
        "last_checked": (
            perk.get("last_checked")
            or perk.get("verified_at")
        ),
        "offer_type": perk.get("offer_type", "other"),
        "availability": perk.get("availability", "active"),
        "caution": perk.get("caution", ""),
        "parent_id": perk.get("parent_id"),
        "student_required": perk["student_required"],
        "researcher_required": perk["researcher_required"],
        "free": perk["free"],
        "why": (
            why_prefix
            + perk["reason"]
        ),
        "source_url": (
            perk["source_url"]
        ),
    }


def find_perks(args):
    perks = load_perks()
    ranked = []

    for perk in perks:
        result = score_perk(
            perk,
            args,
        )

        if result is not None:
            ranked.append(result)

    ranked.sort(
        key=lambda item: (
            item["match_score"]
        ),
        reverse=True,
    )

    return {
        "results": ranked,
        "total_matches": len(ranked),
        "catalog_size": len(perks),
        "generated_on": (
            date.today().isoformat()
        ),
    }


def invoke(method, args):
    if method == "find_perks":
        return {
            "success": True,
            "data": find_perks(args),
        }

    return {
        "success": False,
        "error": (
            f"unknown method: {method}"
        ),
    }


def main():
    for line in sys.stdin:
        line = line.strip()

        if not line:
            continue

        req = json.loads(line)

        try:
            if req.get("method") == "describe":
                result = MANIFEST

            elif req.get("method") == "health":
                result = {
                    "status": "ready"
                }

            elif req.get("method") == "invoke":
                result = invoke(
                    req["params"]["tool"],
                    req["params"].get(
                        "arguments",
                        {},
                    ),
                )

            else:
                raise ValueError(
                    "unknown rpc: "
                    f"{req.get('method')}"
                )

            response = {
                "jsonrpc": "2.0",
                "id": req.get("id"),
                "result": result,
            }

        except Exception as error:
            response = {
                "jsonrpc": "2.0",
                "id": req.get("id"),
                "error": {
                    "code": -32601,
                    "message": str(error),
                },
            }

        sys.stdout.write(
            json.dumps(response)
            + "\n"
        )
        sys.stdout.flush()


if __name__ == "__main__":
    main()