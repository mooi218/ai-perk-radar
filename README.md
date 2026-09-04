# AI Perk Radar

AI Perk Radar matches a user profile against a structured catalog of verified AI, developer, student, research, and creator perks. The matcher determines the ranking; Anna's take explains the single highest-ranked verified recommendation without changing that selection.

The app is built as an Anna App with a bundled binary Executa for four supported platforms.

## Local checks

```bash
anna-app validate --strict
python -m unittest discover -s executas/ai-perk-radar/tests -v
node --test tests/test_ui_recommendation.mjs
```

Build the Executa for the current platform:

```bash
python executas/ai-perk-radar/build_binary.py
```

## Catalog operations

The catalog is self-maintained and prioritizes official primary sources. Every active record includes source, verification, availability, deadline, and caution metadata used by the matcher and UI.

See [Catalog maintenance](docs/CATALOG_MAINTENANCE.md) for the verification cadence, change states, expiry handling, and product differentiation. See [v0.1.5 review notes](docs/REVIEW_NOTES_0.1.5.md) for the Anna review fixes.
