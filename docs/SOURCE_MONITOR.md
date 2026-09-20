# Official-source observations

`scripts/source_monitor.py` is a Python 3.12 standard-library monitor. It performs
no model calls, uses no paid search/API service, and never invokes Anna in the
background. Its output is evidence for review, not a verified offer catalog.
The existing catalog remains the source for eligibility and recommendations.

## What it observes

The monitor deduplicates catalog source URLs, removes fragments, and treats the
two GitHub Education `/pack` spellings as one source. Hosts must also appear in
the reviewed allowlist in `monitoring/sources.json`; adding a catalog URL cannot
silently grant a new host access.

The GitHub Education adapter scans all offer cards on the official listing,
including cards absent from the current catalog. It requires stable card IDs,
the `Offers` section, offer headings and complete offer paragraphs. It hashes
the normalized title and terms, excluding navigation, support links, marketing
descriptions and tags. A configured association connects known card IDs with
catalog IDs; an unassociated card is only an *unregistered candidate*, not proof
of a new product or a new announcement. Associations may need human correction
when a provider renames an offer or when a catalog record describes another plan.

Other sources use their single intact `main`/`article` region, with a heading and
substantial relevant content. Navigation, scripts, styles, sidebars, footers,
buttons and SVGs are excluded. This broad adapter detects main-content changes;
it cannot decide whether a change is material to a benefit. Unsupported layouts
or pages requiring JavaScript are reported as unknown and need a reviewed
source-specific adapter or interactive review through Anna.

No raw page or full terms are saved. Output retains hashes, titles (at most 120
characters), official source URLs and observation metadata. Discovered outgoing
links are never crawled; offer links are generated from the allowlisted listing
URL and a validated fragment ID.

## Crawl policy and failure handling

- HTTPS only, explicit hosts, no userinfo/nonstandard ports/control characters.
  Every network connection resolves and rejects non-public, reserved, local,
  loopback, metadata and multicast addresses. The chosen public IP is pinned to
  the connection; TLS still verifies the original hostname. Environment proxies,
  cookies and credentials are not used.
- `robots.txt` is fetched once per origin per run. A 404 means no policy file;
  any other unsuccessful status, invalid policy, browser challenge or unsupported
  encoding stops that origin. User-agent groups, wildcard/terminal rules,
  `Crawl-delay` and `Request-rate` are honored. Default spacing is two seconds.
- At most three redirects are followed, only on the original allowlisted host;
  each target page is rechecked against robots rules. Cross-host redirects need
  source review, even when the other host is independently allowlisted.
- Requests have a 20-second budget (including a maximum ten-second DNS wait),
  a 2 MiB body limit, and identity/UTF-8 encoding. Robots files have a 256 KiB
  limit. Runs have an eight-minute network budget and at most 120 unique sources;
  a workflow has a fifteen-minute outer limit. A crawl delay exceeding 30 seconds
  defers the source to a later run. There are no immediate retries after 429/5xx.
- Errors, HTML challenges, oversized/truncated responses, unexpected layouts,
  duplicate/unsafe offer IDs and missing terms produce `unknown`, never
  `unchanged` or `expired`. An omitted previous card also produces `unknown`:
  absence can result from a partial listing and does not establish expiry.
- A failed or incomplete source retains its entire last good snapshot. Other
  successful sources can advance independently. `last_successful_fetch` and a
  `stale` flag (>24 hours, or no successful observation) expose gaps. These are
  machine observation times, never human verification dates.

The monitor cannot guarantee detection of every possible redesign or deceptive
HTTP-200 response. Its bounded, source-specific checks and offline fixtures make
known failure modes visible. Eligibility, region, payment requirements, deadlines
and expiry still require evidence review before catalog publication.

## Running and reviewing

```sh
python -m unittest discover -s tests -p test_source_monitor.py -v
python scripts/source_monitor.py --catalog executas/ai-perk-radar/ai_perk_radar/opportunities.json --state .source-monitor/state.json --output .source-monitor/report.json --state-output .source-monitor/state.json
```

Use `--sources PATH` to select a reviewed configuration. The default paths are
relative to the repository root, not the caller's working directory. State/report
are machine-generated local files; do not commit them or publish them as verified
catalog data. Exit 0 means all selected sources were observed; 2 means a report
was written with partial coverage; 3 means a report was written but no source was
usable; 1 means an input/output/configuration error prevented a complete report.
Invalid state is never silently discarded or
overwritten. Input/output overlap checks protect the catalog and source config.

An absent state file creates an explicit `initial` baseline. Initial observations
use `baseline`, not `new`. To begin a new baseline after reviewing a real listing
removal or parser change, preserve the old report/state as review evidence and
run with a fresh state path. Do not edit only a stored hash. A baseline reset is
an observation reset, not an offer verification or publication.

## Artifact contract (schema 1)

The JSON report contains:

- `schema_version`, `parser_version`, `generated_at`, `completed_at`,
  `catalog_revision`, `semantics`, `baseline_status` and `previous_run_at`.
- `summary`: source counts for `baseline`, `unchanged`, `changed`, `unknown`,
  `observed_sources`, `manual_required`, `source_errors`, `stale_sources`, plus
  `unregistered_candidates`.
- `sources[]`: `source_url`, `adapter`, associated `catalog_ids`, `status`,
  `fetched_at`, `previous_baseline`, `last_successful_fetch`, `stale`, and `items`.
  Successful fetches include `resolved_url`; accepted observations include
  `content_hash` with `previous_content_hash` for comparisons.
  Unknown sources include a stable `error_code` and concise `message`. A rejected
  unsafe catalog URL deliberately omits the URL from the report.
  `coverage_gap` distinguishes known manual-review needs (layout, challenges,
  robots denial, redirects) from fetch or unknown-policy errors. Both remain
  `unknown`; neither establishes fresh terms.
- `items[]`: short title, stable listing ID, official `source_url`, observation
  `status`, and catalog associations. Unregistered cards appear on every good
  listing scan with `unregistered_candidate: true`, including unchanged cards.
  Missing cards have `status: unknown` and
  `reason: missing_from_listing_not_confirmed_ended`.

The separate state contains the schema/parser versions, `generated_at`, and a
source-keyed map of adapter, `fetched_at`, aggregate `content_hash`, and item
title/hash/source URL. Its size, shape, URLs, timestamps, item limits and aggregate
hashes are validated before reuse. State is an untrusted observation cache, never
an authority for eligibility or verified dates. A future Anna review tool can
consume the report's official links and changed IDs without fetching all pages
again; it must retain the distinction between observed and verified data.

## Scheduled workflow

`.github/workflows/monitor-sources.yml` prepares a read-only scan every six hours
at minute 23, plus manual dispatch. Scheduling starts only after that workflow
exists on the default branch and Actions is enabled; this change itself does not
deploy or activate an external service. Pull requests run offline regression and
catalog validation only. Live scanning is restricted to the default branch.

The workflow uses `contents: read`, persists no checkout credentials, creates no
issue/PR, commits no catalog change and calls no Anna/LLM API. It uploads a
downloadable report and state with 30-day retention. A job summary and warning
make partial coverage explicit without failing every scheduled run for a
persistent JavaScript/robots limitation. Scanner/input failures and runs with
zero usable sources fail the workflow. The report retains every source error;
a successful workflow is not a claim of complete coverage or verified offers.
There is no separate message sender.
GitHub runner, cache and artifact usage remains subject to the repository's
existing Actions allocation; no paid service or billing setting is enabled here.

State caching uses a code/config hash prefix and a **new run ID/attempt key on
every save**. The restore prefix selects the newest compatible cache. Reusing a
single immutable cache key would freeze the first baseline, so it is deliberately
avoided. Cache eviction or a code/config change creates an explicitly labeled
initial baseline. The cache is an optimization; download artifacts if history
must be retained longer. Schedule delays, inactivity disablement and cache
retention remain subject to [GitHub Actions scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
and [cache behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).

Tests cover discovery beyond catalog membership, known term changes, omitted
cards, parser drift, title/fragment injection, HTTP truncation and byte limits,
challenge pages, unsafe/private DNS and redirects, robots failures and delays,
stale preserved state and invalid snapshot inputs. All fixtures are synthetic;
the test suite has no network dependency.
