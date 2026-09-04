# Catalog maintenance and product edge

## Current catalog

AI Perk Radar uses a self-maintained structured catalog. Version 0.1.5 intentionally starts with 25 high-confidence opportunities rather than padding the results with unverified offers.

Each record carries the fields needed to evaluate and audit it, including:

- `source_url` and `source_quality`
- `verified_at` and `last_checked`
- `availability`
- `deadline`
- `caution`
- eligibility, region, offer type, value, and interest metadata

Official primary sources are preferred. A record is not treated as verified merely because it appears in a search result, blog post, or generated answer.

## Verification cadence

- Time-limited and newly announced offers are rechecked at least weekly while active.
- Ongoing plans and free tiers are rechecked at least every 30 days.
- A record is rechecked immediately when an official source signals a pricing, eligibility, availability, or deadline change.
- `last_checked` is updated only after the official source has been reviewed.

The current workflow is human-reviewed. Automated source-change detection is planned as an aid, but it will not publish catalog changes without verification.

## Changed, uncertain, and expired records

- `active`: the official source currently supports the stated offer.
- `check`: the offer exists, but current enrollment or availability needs confirmation. These records may be shown with a warning but are never selected for Anna's take.
- `expired`: the deadline has passed or the official source confirms the offer has ended. Dated records are also excluded automatically once their deadline passes.

When a material term changes, the record is updated and the change is noted before its verification date advances. Expired records leave active matching immediately. They remain in repository history for auditability rather than being silently erased.

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

These are roadmap items, not claims about functionality in v0.1.5. The review release stays focused on correctness, source quality, and a reliable recommendation path.
