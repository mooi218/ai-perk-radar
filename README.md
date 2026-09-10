# AI Perk Radar

AI Perk Radar matches a user profile against a structured catalog of verified AI, developer, student, research, and creator perks. The matcher determines the ranking; Anna's take explains the single highest-ranked verified recommendation without changing that selection.

The app is built as an Anna App with a bundled binary Executa for four supported platforms.

## Local checks

```bash
anna-app validate --strict
python scripts/check_catalog.py
python -m unittest discover -s executas/ai-perk-radar/tests -v
node --test tests/test_ui_recommendation.mjs tests/test_catalog_fetch.mjs
```

Build the Executa for the current platform:

```bash
python executas/ai-perk-radar/build_binary.py
```

## Catalog operations

The catalog is self-maintained and prioritizes official primary sources. Every active record includes source, verification, availability, deadline, and caution metadata used by the matcher and UI.

From v0.1.6, every **Find my perks** click downloads the latest JSON from the fixed public GitHub endpoint. The unchanged Executa validates that data and ranks it; the catalog is no longer embedded in the binary. English and Japanese offer details travel together. A network or validation failure clears previous results and shows a retry message rather than presenting an old catalog as current.

For a catalog-only update, edit `executas/ai-perk-radar/ai_perk_radar/opportunities.json`, update its revision/publication timestamp, validate it, and commit/push it to `main`. No binary build, App cut, reinstall, or user-specific data upload to GitHub is required. `last_checked` means a human source review, not a data download. The data-validation workflow checks catalog changes independently of the manual binary-build workflow.

See [Catalog maintenance](docs/CATALOG_MAINTENANCE.md) for the verification cadence, change states, expiry handling, and product differentiation. [v0.1.6 review notes](docs/REVIEW_NOTES_0.1.6.md) explain the complete update flow and its security boundary. [v0.1.5 review notes](docs/REVIEW_NOTES_0.1.5.md) cover the earlier fixes.
