# Source review candidates

The existing six-hour official-source monitor prepares `review.json` and an
offline `review.html` after each completed scan. It uses the reviewed source
configuration and current catalog, with no new scheduler, service, secret,
model call, or Anna deployment. The app and public catalog are not modified.

## What a candidate means

- Existing catalog IDs and facts are retained for comparison. Machine
  observations do not advance human verification dates or offer availability.
- Source URL, fetch time, previous/current evidence hashes, and an optional
  excerpt remain attached to each item. Excerpts contain at most 600 characters
  of normalized untrusted text and may omit relevant terms.
- Unknown dates, regions, student/research eligibility, amounts, and
  availability remain `null`; `proposed_changes` stays empty. A failed fetch or
  missing listing card requires review and does not establish offer expiry.
- Unregistered cards come only from the existing approved listing adapter.
  They are not proof of a newly announced offer and are never crawled further.
- Candidate IDs are deterministic and duplicate observations collapse. The
  initial baseline is labeled `baseline`, not a newly discovered benefit.

## Workflow and artifacts

`.github/workflows/monitor-sources.yml` retains its existing
`23 */6 * * *` schedule, `contents: read`, and 30-day artifact retention. PRs
run offline tests only; live observation remains restricted to the default
branch. The workflow adds no catalog commit or publication step.

Each `official-source-observations-<run_id>-<attempt>` artifact contains:

| File | Purpose |
| --- | --- |
| `report.json` | Observations, coverage gaps, and scan metrics |
| `state.json` | Reusable successful snapshots without excerpts |
| `review.json` | Review candidates with evidence and current catalog facts |
| `review.html` | Static preview of those candidates |

Download the artifact and open `review.html` locally. Every value is escaped;
source scripts, event attributes, images, forms, and remote assets are not
included. A restrictive Content Security Policy blocks executable content.
Treat excerpts as evidence to inspect, never as instructions. Check complete
official terms before making a separate manual catalog change.

Artifacts in this public repository are accessible to signed-in readers.
They contain public-source observations, not user profiles or saved perks.
Existing request limits, robots policy, timeouts, DNS/redirect restrictions,
and failure-preserving snapshots remain enforced by the scanner.

Changing the scanner's code hash starts a fresh compatible cache baseline.
Consequently, the first run after this update may list baseline observations;
its candidate count is not a count of new offers. A successful workflow can
still have incomplete coverage; inspect `summary` and manual-review items.

## Local checks

```sh
python -m unittest discover -s tests -p test_source_monitor.py -v
python -m unittest discover -s tests -p test_source_review.py -v
python -m unittest discover -s executas/ai-perk-radar/tests -v
node --test tests/*.mjs
python scripts/check_catalog.py
```

To prepare a preview from a completed scan, run
`python scripts/source_review.py`. It performs no network requests and writes
only distinct `.json`/`.html` outputs inside `.source-monitor/`, protecting the
catalog, report, source configuration, state, and script inputs.
