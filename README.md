# AI Perk Radar

AI Perk Radar matches a user profile against a structured catalog of verified AI, developer, student, research, and creator perks. The matcher determines the ranking; Anna's take explains the single highest-ranked verified recommendation without changing that selection.

The app is built as an Anna App with a bundled binary Executa for four supported platforms.

## Local checks

```bash
anna-app validate --strict
python scripts/check_catalog.py
python -m unittest discover -s executas/ai-perk-radar/tests -v
node --test tests/*.mjs
python -m unittest discover -s tests -p test_source_monitor.py -v
python scripts/catalog_health.py
```

Build the Executa for the current platform:

```bash
python executas/ai-perk-radar/build_binary.py
```

## Catalog operations

The catalog is self-maintained and prioritizes official primary sources. Every active record includes source, verification, availability, deadline, and caution metadata used by the matcher and UI.

The current catalog contains **100 opportunities**, with Japanese descriptions for every record. Two records have unresolved enrollment/terms questions and are marked `check`, not eligible for the top recommendation. The [September 20 expansion notes](docs/CATALOG_EXPANSION_0.1.8.md) list primary evidence, activation/payment caveats, and verification limits. A fit score is not an eligibility probability or guarantee.

From v0.1.6, every **Find my perks** click downloads the latest JSON from the fixed public GitHub endpoint. The unchanged Executa validates that data and ranks it; the catalog is no longer embedded in the binary. English and Japanese offer details travel together. A network or validation failure clears previous results and shows a retry message rather than presenting an old catalog as current.

For a catalog-only update, edit `executas/ai-perk-radar/ai_perk_radar/opportunities.json`, update its revision/publication timestamp, validate it, and commit/push it to `main`. No binary build, App cut, reinstall, or user-specific data upload to GitHub is required. `last_checked` means a human source review, not a data download. The data-validation workflow checks catalog changes independently of the manual binary-build workflow.

See [Catalog maintenance](docs/CATALOG_MAINTENANCE.md) for the verification cadence, change states, expiry handling, and product differentiation. [v0.1.6 review notes](docs/REVIEW_NOTES_0.1.6.md) explain the complete update flow and its security boundary. [v0.1.5 review notes](docs/REVIEW_NOTES_0.1.5.md) cover the earlier fixes.

## Published version: v0.1.7

Version 0.1.7 adds saved perks, profile/language restoration, search and combined filters, and views for New since last visit, Changed, Expiring soon, and Newly for you. Visit metadata and saved labels use Anna's private per-user App storage; current offer terms are always fetched again. Anna's optional explanation is requested with a button, while deterministic matching returns immediately.

The matcher also fixes Windows UTF-8 input handling and keeps running after malformed JSON-RPC requests. See [review notes](docs/NEXT_RELEASE_0.1.7.md). Anna's API confirmed v0.1.7 as published on September 20, 2026. [Open the App Store listing](https://anna.partners/store/@chiku/ai-perk-radar).

## Next version: v0.1.8

The next version adds explicit, tool-only discovery through Anna Web, separate from the maintained catalog. Selected official domains, bounded basic searches, visible usage consent, optional per-page retrieval, seven-day private search history and safely escaped source text keep cost and trust boundaries visible. Search candidates never become verified offers automatically. New Web grants require Anna consent; Agent sessions stay disabled.

This version also retains ended/removed prior matches in Changed, excludes stale records from the top recommendation, shows eligibility caveats with that recommendation, rejects old-profile responses, and uses independent APS bookmark records to preserve concurrent first saves. See [v0.1.8 notes](docs/NEXT_RELEASE_0.1.8.md) for validation and deployment status.

The separate [official-source monitor](docs/SOURCE_MONITOR.md) discovers unregistered listing entries and observes page changes every six hours through a read-only repository workflow. It uses no LLM and never advances verification dates or publishes catalog edits. Unsupported/blocked sources require manual review; background monitoring is not a promise that all offers were freshly verified.

The [source review pipeline](docs/SOURCE_REVIEW.md) adds candidate JSON and a
static HTML preview to that same workflow. Official source evidence remains
unverified until a human checks it; the pipeline has no catalog-writing step.
