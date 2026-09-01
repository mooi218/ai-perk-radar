"""Opportunity matching engine for AI Perk Radar."""

import json
import sys
from datetime import date, datetime


MANIFEST = {
    "name": "tool-dev-ai-perk-radar",
    "version": "0.2.0",
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
                    "priority",
                    "interests",
                ],
                "additionalProperties": False,
            },
        }
    ],
}


PERKS = [
    {
        "id": "google-ai-plus-student-2026",
        "title": "Google AI Plus - 12 months free",
        "provider": "Google",
        "regions": ["JP"],
        "student_required": True,
        "researcher_required": False,
        "interests": ["ai", "creator"],
        "free": True,
        "value_score": 75,
        "value_display": "About JPY 8,700",
        "deadline": "2026-12-31",
        "announced": "2026-08-20",
        "source_url": "https://blog.google/intl/ja-jp/company-news/technology/gemini-student-offer-google-ai/",
        "reason": (
            "Eligible higher-education students in Japan can receive "
            "Google AI Plus for 12 months at no charge. "
            "The offer includes higher Gemini limits and 400 GB of storage."
        ),
    },
    {
        "id": "aws-student-rewards-2026",
        "title": "AWS Student Rewards",
        "provider": "Amazon Web Services",
        "regions": ["GLOBAL"],
        "student_required": True,
        "researcher_required": False,
        "interests": ["ai", "coding", "cloud"],
        "free": True,
        "value_score": 95,
        "value_display": "Up to about USD 579",
        "deadline": None,
        "announced": "2026-08-20",
        "source_url": "https://aws.amazon.com/blogs/aws/aws-weekly-roundup-student-rewards-on-aws-builder-center-local-zone-in-las-vegas-and-more-august-24-2026/",
        "reason": (
            "Verified higher-education students worldwide can unlock "
            "12 months of AWS Skill Builder Premium. Additional badges "
            "can unlock AWS credits and a certification exam voucher."
        ),
    },
    {
        "id": "zed-student-plan-2026",
        "title": "Zed Student - Pro free for one year",
        "provider": "Zed",
        "regions": ["GLOBAL"],
        "student_required": True,
        "researcher_required": False,
        "interests": ["ai", "coding"],
        "free": True,
        "value_score": 82,
        "value_display": "12 months Pro + USD 10/mo AI credits",
        "deadline": None,
        "announced": "2026-03-09",
        "source_url": "https://zed.dev/education",
        "reason": (
            "Verified university students worldwide receive Zed Pro "
            "for one year, including unlimited edit predictions and "
            "USD 10 per month in AI token credits."
        ),
    },
    {
        "id": "anthropic-scientist-team-2026",
        "title": "Claude Team plan for scientists",
        "provider": "Anthropic",
        "regions": ["GLOBAL"],
        "student_required": False,
        "researcher_required": True,
        "interests": ["ai", "coding", "research"],
        "free": True,
        "value_score": 96,
        "value_display": "Standard seats free for 12 months",
        "deadline": None,
        "announced": "2026-08-27",
        "source_url": "https://www.anthropic.com/news/expanding-support-for-scientists",
        "reason": (
            "Anthropic opened an initial 10,000 seats for scientists "
            "worldwide. Standard Claude Team seats are free for one year, "
            "with discounted premium seats also available."
        ),
    },
]


def parse_date(value):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def region_matches(perk, country):
    regions = perk["regions"]
    return "GLOBAL" in regions or country in regions


def freshness_label(announced):
    announced_date = parse_date(announced)

    if not announced_date:
        return "Current"

    days = (date.today() - announced_date).days

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

    return parse_date(deadline).strftime("%b %d, %Y")


def score_perk(perk, profile):
    if not region_matches(perk, profile["country"]):
        return None

    if perk["student_required"] and not profile["student"]:
        return None

    if perk["researcher_required"] and not profile["researcher"]:
        return None

    score = 35
    reasons = []

    interests = set(profile.get("interests", []))
    matching_interests = interests.intersection(perk["interests"])

    score += min(24, len(matching_interests) * 9)

    if matching_interests:
        reasons.append(
            "matches " + ", ".join(sorted(matching_interests))
        )

    if profile["student"] and perk["student_required"]:
        score += 18
        reasons.append("student eligibility")

    if profile["researcher"] and perk["researcher_required"]:
        score += 18
        reasons.append("research eligibility")

    priority = profile["priority"]

    if priority == "free" and perk["free"]:
        score += 18
        reasons.append("no-cost offer")

    if priority == "value":
        score += round(perk["value_score"] * 0.22)
        reasons.append("high estimated value")

    if priority == "deadline":
        deadline = parse_date(perk["deadline"])

        if deadline:
            remaining = (deadline - date.today()).days

            if remaining <= 30:
                score += 25
            elif remaining <= 90:
                score += 18
            else:
                score += 8

            reasons.append("time-limited")

    announced = parse_date(perk["announced"])

    if announced:
        age = (date.today() - announced).days

        if age <= 14:
            score += 10
        elif age <= 45:
            score += 6

    score = max(1, min(99, score))

    why_prefix = (
        "Strong fit because of " + ", ".join(reasons) + ". "
        if reasons
        else ""
    )

    return {
        "id": perk["id"],
        "title": perk["title"],
        "provider": perk["provider"],
        "match_score": score,
        "value_display": perk["value_display"],
        "deadline_display": deadline_label(perk["deadline"]),
        "freshness": freshness_label(perk["announced"]),
        "why": why_prefix + perk["reason"],
        "source_url": perk["source_url"],
    }


def find_perks(args):
    ranked = []

    for perk in PERKS:
        result = score_perk(perk, args)

        if result is not None:
            ranked.append(result)

    ranked.sort(
        key=lambda item: item["match_score"],
        reverse=True,
    )

    return {
        "results": ranked[:5],
        "total_matches": len(ranked),
        "generated_on": date.today().isoformat(),
    }


def invoke(method, args):
    if method == "find_perks":
        return {
            "success": True,
            "data": find_perks(args),
        }

    return {
        "success": False,
        "error": f"unknown method: {method}",
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
                result = {"status": "ready"}

            elif req.get("method") == "invoke":
                result = invoke(
                    req["params"]["tool"],
                    req["params"].get("arguments", {}),
                )

            else:
                raise ValueError(
                    f"unknown rpc: {req.get('method')}"
                )

            sys.stdout.write(
                json.dumps({
                    "jsonrpc": "2.0",
                    "id": req.get("id"),
                    "result": result,
                }) + "\n"
            )

        except Exception as error:
            sys.stdout.write(
                json.dumps({
                    "jsonrpc": "2.0",
                    "id": req.get("id"),
                    "error": {
                        "code": -32601,
                        "message": str(error),
                    },
                }) + "\n"
            )

        sys.stdout.flush()


if __name__ == "__main__":
    main()

