# v0.1.8 — Anna-native discovery and trustworthy freshness

Implementation and validation in progress on September 20, 2026. Published v0.1.7 remains unchanged until a reviewed update is approved. Data revision `2026-09-20.2` is schema-1 compatible with existing installations; code and data publication are separate operations.

## What changes for users

- Explore beyond the maintained catalog through Anna's `web.search` and `web.fetch`, without an LLM or Agent session. Basic search is limited to six results from a selected group of official hosts. It is initiated only by an explicit button after a cost/data-sharing acknowledgement. Every page fetch is another explicit action. No automatic search retries or paid advanced searches.
- Live-search results are unverified candidate pages, never scored eligible offers. Missing dates remain unknown; requested search windows are not represented as guaranteed offer-expiry filters. Hostile markup stays literal text; unsafe, out-of-scope and selected community-content URLs are rejected. Redirects are constrained; failed, challenge and partial-page fetches do not certify an offer.
- Anna APS stores the last successful search with a seven-day expiry request and bounded snippets. Restoration never re-enables consent or triggers a search. Full fetched page text is not persisted.
- The maintained catalog expands from45 to100. [Source notes](CATALOG_EXPANSION_0.1.8.md) distinguish98 active records from2 unresolved records and preserve all45 prior records' check dates. None of the100 records guarantees an individual user's eligibility.

## Genuine defects found and corrected

- Old `active` records could still win Anna's take after their source check was overdue. Recommendation selection now applies the seven-/thirty-day recheck rule as well as active status.
- High fit percentages could be read as confirmed eligibility, especially for researcher offers that actually require a principal investigator. The UI now says fit points, includes the provider's caution in the top card, and explains the score's limits. Ranking remains deterministic.
- An unknown announcement date was translated as currently available. It now says announcement date unknown. A missing deadline is not described as unlimited availability.
- Ended, removed, and newly-ineligible former matches disappeared from Changed. Visit snapshots now retain short labels and effective status; Changed includes these departed entries without giving them a match score.
- A profile edit during an in-flight search could leave old-profile results below new conditions. Epoch guards discard those results and clear visible matches after a condition change.
- Concurrent first saves could overwrite each other in the single saved-list row. Per-perk APS records preserve independent saves, retain legacy data, and use removal markers. Focus refreshes are guarded against overwriting a newer local save.
- Discovery review caught a community-blog allowlist gap, nondefault search-history restoration failure, incorrect carried-over Web usage, and keyboard-focus loss. All were corrected; source text stays unverified even after successful retrieval.

## Operating boundaries

The [source monitor](SOURCE_MONITOR.md) is a separate, no-LLM, bounded, robots-aware pipeline. It reports changed/new/unknown observations and stores snapshots for future comparison. It never changes `verified_at`, `last_checked`, eligibility, or the published catalog. A maintainer must review and publish actual data edits.

Anna's public APIs support direct tools, Web access, private APS and async jobs. A reliable closed-App recurring trigger has not been confirmed in the current public reference. The repository workflow supplies only the shared maintenance schedule; it does not retain Anna session tokens, invoke users' Agents unattended, or spend their Web/LLM quota.

APS is private per user, not a global catalog store. Shared catalog publication remains maintainer-controlled. The app does not give ordinary users repository write access. No new external browser origin is added; the new host grant is Web search/fetch only, plus listing the app's own storage records. `agent.session.auto` and fixed sessions remain disabled.

## Verification record

- Source tests:27 Node tests,15 matcher/protocol Python tests, and21 offline monitor tests passed (63 total).
- Strict Anna manifest validation passed. The first production draft push rejected `web.search` / `web.fetch` as top-level audit permission names. They were removed from that list; the effective declaration remains `ui.host_api.web: ["search", "fetch"]` with Anna's independent user Web grant. Storage `list` is explicitly declared. A regression test now checks this boundary.
- Actual bundle tested in a local browser harness with100-entry catalog and real source matcher:98 student/developer matches, AWS99 fit points with caution,37 nonstudent/developer matches, Codédex accented search, independent saved record and Japanese restoration, old-condition clearing, and discovery restoration with consent reset.
- The local harness mocks Anna Web/APS/LLM, so these results do not certify a live Anna Web grant, charge or production storage round trip. Mocked candidate pages are explicitly labeled local-test content.
- Keyboard search keeps focus on the result status and announces the count. Hostile mock markup renders as text. Partial source retrieval is visibly marked.420px width checked without horizontal overflow; viewport reset afterward.

Build, live Anna verification, publication and review status must be appended after they actually complete. No new immutable App version has been cut or submitted at the time of this record.
