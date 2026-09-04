import json
import sys
import unittest
from pathlib import Path


EXECUTA_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EXECUTA_ROOT))

import ai_perk_radar_plugin as matcher


REVIEW_PROFILE = {
    "country": "JP",
    "student": True,
    "researcher": False,
    "developer": True,
    "creator": False,
    "founder": False,
    "limited_only": False,
    "priority": "free",
    "interests": [
        "ai",
        "coding",
        "cloud",
    ],
}


def candidate(
    perk_id,
    match_score,
    ranking_score,
    value_score,
    availability="active",
):
    return {
        "id": perk_id,
        "match_score": match_score,
        "_ranking_score": ranking_score,
        "_value_score": value_score,
        "availability": availability,
    }


class RecommendationTests(unittest.TestCase):
    def test_99_percent_match_always_beats_90_percent(self):
        results = [
            candidate("google-ai-plus", 90, 90, 75),
            candidate("github-pack", 99, 108, 98),
            candidate("aws-student", 99, 112, 95),
        ]

        selected = matcher.select_recommendation(
            results
        )

        self.assertEqual(
            selected["id"],
            "aws-student",
        )
        self.assertEqual(
            selected["match_score"],
            99,
        )

    def test_tie_break_is_value_then_stable_id(self):
        results = [
            candidate("zeta", 99, 110, 95),
            candidate("beta", 99, 110, 98),
            candidate("alpha", 99, 110, 98),
        ]

        selected = matcher.select_recommendation(
            results
        )

        self.assertEqual(selected["id"], "alpha")

    def test_uncertain_offer_is_not_recommended(self):
        results = [
            candidate(
                "uncertain",
                99,
                120,
                100,
                availability="check",
            ),
            candidate("verified", 98, 110, 90),
        ]

        selected = matcher.select_recommendation(
            results
        )

        self.assertEqual(
            selected["id"],
            "verified",
        )

    def test_find_perks_returns_highest_match(self):
        payload = matcher.find_perks(
            REVIEW_PROFILE
        )
        recommended = payload["recommended"]
        recommendable = [
            item
            for item in payload["results"]
            if item["availability"] != "check"
        ]

        self.assertEqual(
            recommended["match_score"],
            max(
                item["match_score"]
                for item in recommendable
            ),
        )

        google = next(
            (
                item
                for item in payload["results"]
                if item["id"]
                == "google-ai-plus-student-2026"
            ),
            None,
        )

        if google is not None:
            self.assertGreater(
                recommended["match_score"],
                google["match_score"],
            )
            self.assertNotEqual(
                recommended["id"],
                google["id"],
            )


class CatalogEncodingTests(unittest.TestCase):
    def test_catalog_is_utf8_without_mojibake(self):
        path = (
            EXECUTA_ROOT
            / "ai_perk_radar"
            / "opportunities.json"
        )
        raw = path.read_bytes()

        self.assertFalse(
            raw.startswith(b"\xef\xbb\xbf")
        )

        text = raw.decode("utf-8", errors="strict")

        self.assertNotIn("Cod?dex", text)
        self.assertNotIn("\ufffd", text)

        catalog = json.loads(text)
        codedex = next(
            item
            for item in catalog
            if item["id"] == "github-pack-codedex"
        )

        self.assertEqual(
            codedex["title"],
            "Codédex Club Student",
        )
        self.assertEqual(
            codedex["provider"],
            "Codédex",
        )
        self.assertIn(
            "Codédex",
            codedex["value_display"],
        )
        self.assertIn(
            "Codédex",
            codedex["reason"],
        )


if __name__ == "__main__":
    unittest.main()
