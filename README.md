# AI Perk Radar

AI Perk Radar matches a user profile against a structured catalog of verified AI, developer, student, research, and creator perks. The matcher determines the ranking; Anna's take explains the single highest-ranked verified recommendation without changing that selection.

The app is built as an Anna App with a bundled binary Executa for four supported platforms.

## Local checks

```bash
anna-app validate --strict
python scripts/check_catalog.py
python -m unittest discover -s executas/ai-perk-radar/tests -v
node --test tests/test_ui_recommendation.mjs tests/test_catalog_fetch.mjs tests/test_radar_state.mjs
python scripts/catalog_health.py
```

Build the Executa for the current platform:

```bash
python executas/ai-perk-radar/build_binary.py
```

## Catalog operations

The catalog is self-maintained and prioritizes official primary sources. Every active record includes source, verification, availability, deadline, and caution metadata used by the matcher and UI.

The current catalog contains **45 opportunities**, with Japanese descriptions for every record. The September 11 expansion added ten student offers and ten general-purpose free tiers, and rechecked key AI offers with clearer eligibility and renewal warnings.

From v0.1.6, every **Find my perks** click downloads the latest JSON from the fixed public GitHub endpoint. The unchanged Executa validates that data and ranks it; the catalog is no longer embedded in the binary. English and Japanese offer details travel together. A network or validation failure clears previous results and shows a retry message rather than presenting an old catalog as current.

For a catalog-only update, edit `executas/ai-perk-radar/ai_perk_radar/opportunities.json`, update its revision/publication timestamp, validate it, and commit/push it to `main`. No binary build, App cut, reinstall, or user-specific data upload to GitHub is required. `last_checked` means a human source review, not a data download. The data-validation workflow checks catalog changes independently of the manual binary-build workflow.

See [Catalog maintenance](docs/CATALOG_MAINTENANCE.md) for the verification cadence, change states, expiry handling, and product differentiation. [v0.1.6 review notes](docs/REVIEW_NOTES_0.1.6.md) explain the complete update flow and its security boundary. [v0.1.5 review notes](docs/REVIEW_NOTES_0.1.5.md) cover the earlier fixes.

## Review candidate: v0.1.7

The next UI adds saved perks, profile/language restoration, search and combined filters, and views for New since last visit, Changed, Expiring soon, and Newly for you. Visit metadata and saved labels use Anna's private per-user App storage; current offer terms are always fetched again. Anna's optional explanation is requested with a button, while deterministic matching returns immediately.

The matcher also fixes Windows UTF-8 input handling and keeps running after malformed JSON-RPC requests. See [review notes](docs/NEXT_RELEASE_0.1.7.md). Version 0.1.7 has been cut and resubmitted; Anna now lists it as the pending review candidate. It has not been publicly released yet.
