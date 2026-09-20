# v0.1.8 — Anna-native discovery and trustworthy freshness

Version0.1.8 was submitted for **release review** on September20,2026: App version830, Executa version509, UI bundle786. The server confirmed `release_review_state: pending`, `is_latest: false`, and no publication timestamp. An independent read confirmed App status `published`, latest version0.1.7, and review candidate0.1.8. Published v0.1.7 remains live while the update is reviewed. Data revision `2026-09-20.2` is already live and schema-1 compatible with existing installations; code and data publication are separate operations.

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

- Source tests:28 Node tests,15 matcher/protocol Python tests, and22 offline monitor/configuration tests passed (65 total). [Final regression run](https://github.com/mooi218/ai-perk-radar/actions/runs/35499550412).
- Strict Anna manifest validation passed. The first production draft push rejected `web.search` / `web.fetch` as top-level audit permission names. They were removed from that list; the effective declaration remains `ui.host_api.web: ["search", "fetch"]` with Anna's independent user Web grant. Storage `list` is explicitly declared. A regression test now checks this boundary.
- Actual bundle tested in a local browser harness with100-entry catalog and real source matcher:98 student/developer matches, AWS99 fit points with caution,37 nonstudent/developer matches, Codédex accented search, independent saved record and Japanese restoration, old-condition clearing, and discovery restoration with consent reset.
- The local harness mocks Anna Web/APS/LLM, so these results do not certify a live Anna Web grant, charge or production storage round trip. Mocked candidate pages are explicitly labeled local-test content.
- Keyboard search keeps focus on the result status and announces the count. Hostile mock markup renders as text. Partial source retrieval is visibly marked.420px width checked without horizontal overflow; viewport reset afterward.

## Completed distribution and live checks

All four OS builds succeeded in [run35498698350](https://github.com/mooi218/ai-perk-radar/actions/runs/35498698350), from code commit `abe8bcd`. Archive contents, SHA-256, entrypoints and0755 executable permissions were checked. The actual packaged Windows executable reported0.1.8 and processed the live100-record UTF-8 catalog with98 matches, AWS99 fit points, and intact Codédex text. Later commit `51efd80` changes only the App ACL, monitoring artifact configuration, tests and notes; the matcher binary is unchanged.

Executa0.1.8 is registered under the existing tool ID with version ID509. The working App draft is revision9, eight files/95,911bytes, content hash `c99f078de990ba5efc53599a588719db8796969ccfc1d377142eae92a1d661cb`. The cut freezes Executa509 and bundle786, whose manifest hash is `b53461a9a7e498659c52a061858a2d19399b26ddbf9aece9d7f5a7f5906ea96e`.

The developer installed this working draft in Anna. Actual Anna APIs verified profile/Japanese restoration, source-linked100-record catalog processing, an APS per-perk save surviving a complete reload, and restoration of the five real Web search results with consent unchecked and no full source text persisted. The temporary Codédex bookmark was removed from the saved list afterward, restoring the initially empty list.

One actual basic Anna Web search returned five allowlisted candidate pages and reported6.8966CU. One explicit source fetch reported1CU and returned the primary page text. No LLM was used for these operations. Search results included regional and older material despite the requested time window, confirming why search snippets, dates and eligibility cannot be promoted directly into verified catalog facts. Retrieved source text remains the basis for subsequent review.

### Remaining runtime verification boundary

The author's existing Cloud Agent continued to report running matcher0.1.7 even though its registration and the explicit Upgrade target said0.1.8. An Upgrade response still returned a0.1.7 manifest. The published App remains frozen to0.1.7, so this may involve App-version asset resolution; the exact Anna-side cause is not established. No unrelated Agent, plugin or grant was changed to work around it.

Accordingly, the Anna-native UI/Web/APS checks above are real, but they are **not proof that the0.1.8 matcher was executing in Anna**. That matcher was verified from the actual packaged binary and four-OS CI. After approval, verify the installed App and running matcher both resolve to0.1.8 before claiming a complete production end-to-end upgrade. The immutable review candidate already freezes the correct Executa509.

## Monitoring deployment

The six-hour workflow is on `main`. The first hosted run exposed an artifact-upload omission: `actions/upload-artifact` excluded the hidden `.source-monitor` directory. The workflow now explicitly includes only `report.json` and `state.json`, includes hidden files, and fails if those expected files are missing. A regression check covers that configuration.

[Successful follow-up run35499616610](https://github.com/mooi218/ai-perk-radar/actions/runs/35499616610) produced a downloadable report and reused the previous baseline. Of81 sources,55 were observed unchanged and26 remained unknown;29 unregistered listing candidates were reported. The report separates18 manual-review gaps from8 source errors. Those are observations, not new verified offers. It did not change any catalog verification date, eligibility condition or availability state.
