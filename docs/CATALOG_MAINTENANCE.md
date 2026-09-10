# Catalog maintenance and product edge

## Current catalog

AI Perk Radar uses a self-maintained structured catalog, currently containing 45 opportunities. The catalog lives in the public project repository and has its own schema version, revision, and publication timestamp. Its content can change independently of the App and Executa version.

Each record carries the fields needed to evaluate and audit it, including:

- `source_url` and `source_quality`
- `verified_at` and `last_checked`
- `availability`
- `deadline`
- `caution`
- eligibility, region, offer type, value, and interest metadata

Official primary sources are preferred. A record is not treated as verified merely because it appears in a search result, blog post, or generated answer.

## Delivery to existing users

The canonical data file is `executas/ai-perk-radar/ai_perk_radar/opportunities.json` on `main`. GitHub hosts its raw HTTPS representation at:

https://raw.githubusercontent.com/mooi218/ai-perk-radar/main/executas/ai-perk-radar/ai_perk_radar/opportunities.json

Every **Find my perks** click fetches this fixed endpoint again with browser caching disabled and a time-only cache key. After validation, the entire new catalog replaces the previous result input. Added entries appear, changed terms and translations replace the previous ones, and removed or expired entries stop matching. Existing v0.1.6 installations receive the changes on the next search without updating or reinstalling the App or Executa.

There is no background polling while the app is idle. GitHub's publication/CDN propagation can introduce a short delay. If fetching or validation fails, the app clears old results, provides a retry message, and does not recommend from a baked-in or stale fallback.

The UI shows when the catalog was downloaded. Each card separately shows the date its official source was last reviewed. Downloading a catalog never advances a record's verification date.

## Human verification cadence

- Time-limited and newly announced offers are rechecked at least weekly while active.
- Ongoing plans and free tiers are rechecked at least every 30 days.
- A record is rechecked immediately when an official source signals a pricing, eligibility, availability, or deadline change.
- `last_checked` is updated only after the official source has been reviewed.

These are the operating targets for the human-reviewed workflow, not an automated source-monitoring service. Dates advance only for actual reviews. Automated source-change detection is planned as an aid, but it will not publish catalog changes without verification.

## Publishing a data-only change

1. Review the official source. Edit the affected records, including their Japanese `localizations.ja` fields when provided. Keep stable IDs; record a real `last_checked` date and update verification only where supported.
2. Advance the catalog's `revision` and UTC `published_at`. These describe the data release, not an App version or a new review of every source.
3. Run `python scripts/check_catalog.py` before publishing. This is the same strict validator used by the released matcher.
4. Commit and push the reviewed catalog to `main`. The `Validate catalog data` workflow rechecks the JSON independently. The binary-build workflow is manual and is not triggered by catalog edits.
5. Search from an existing installation and verify the changed details. Inspect the source dates as well as successful retrieval.

Only repository maintainers can change `main`; ordinary app users have read-only public access to this file. No new publishing credential or service account is embedded in the app. This project does not claim that branch protection or automatic approval of catalog edits is configured.

## Changed, uncertain, and expired records

- `active`: the official source currently supports the stated offer.
- `check`: the offer exists, but current enrollment or availability needs confirmation. These records may be shown with a warning but are never selected for Anna's take.
- `expired`: the deadline has passed or the official source confirms the offer has ended. Dated records are also excluded automatically once their deadline passes.

When a material term changes, the record is updated and the change is described in its commit before its verification date advances. Expired records leave matching on the next successful search; dated records are also filtered against the current day. Removed records are not merged back from any local catalog. Repository history retains earlier versions for auditability. When removing a bundle, remove or update its child records in the same edit.

## Why this is more useful than a one-off search

AI Perk Radar is not a generic prompt asking an AI to remember available perks. Its advantage is the combination of:

1. a persistent, freshness-tracked catalog backed by official sources;
2. structured eligibility and regional matching;
3. deterministic ranking that an LLM cannot override;
4. visible deadlines, cautions, and last-checked dates; and
5. direct links to the source a user should verify before applying.

That structure makes answers reproducible and maintainable in a way a one-off search or chat response is not.

## Return-use roadmap

After review approval, the next catalog-focused iterations are planned around reasons to return rather than a one-time lookup:

- **New since last visit**: verified additions after the user's previous visit.
- **Expiring soon**: eligible offers approaching their deadline.
- **Changed**: material eligibility, value, or availability updates.
- **For you**: newly relevant offers after a profile or catalog change.

These views are implemented in the v0.1.7 working draft, together with saved perks and profile restoration. They are not available in the v0.1.6 review candidate. New and Changed compare actual catalog membership and material fields against the prior visit; updating only verification dates does not create a Changed event. Newly for you highlights existing catalog entries that now match the profile.

Run `python scripts/catalog_health.py` to list verification-due, expired, uncertain, or untranslated entries. `--date YYYY-MM-DD` can preview future maintenance needs. The report never advances verification dates or claims that links/content have been checked automatically.
