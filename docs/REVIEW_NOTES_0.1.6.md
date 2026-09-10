# Anna review response: independent catalog delivery in v0.1.6

The previous release embedded the catalog in the Executa and Japanese offer descriptions in the UI. That meant data changes required a new release. Version 0.1.6 removes both dependencies: the browser retrieves a separate JSON catalog, and the reviewed matching logic consumes only validated data.

## Source and hosting

- Self-maintained catalog; official primary sources are linked in each record.
- Hosted as a public UTF-8 JSON file in the existing `mooi218/ai-perk-radar` GitHub repository, on `main`.
- Fixed endpoint: https://raw.githubusercontent.com/mooi218/ai-perk-radar/main/executas/ai-perk-radar/ai_perk_radar/opportunities.json
- The envelope includes `schema_version: 1`, an independent `revision`, `published_at` in UTC, and `opportunities`. Perk facts, source URLs, availability, deadlines, cautions, and Japanese translations are all data.

## Fetch and refresh trigger

1. The user clicks **Find my perks**. This also serves as an explicit refresh.
2. The UI clears previous results and performs one HTTPS GET to the fixed catalog URL with a time-only cache key, `cache: no-store`, `credentials: omit`, `referrerPolicy: no-referrer`, and `redirect: error`.
3. The response is limited to 256 KiB and 10 seconds, including body reading. Only JSON/plain-text media types and strict UTF-8 without a BOM are accepted.
4. The UI sends the catalog JSON and the selected profile to the existing matcher through `anna.tools.invoke`.
5. The matcher validates the envelope and each record before scoring. Results carry the catalog revision and SHA-256 for reproducibility. The UI displays the retrieval time separately from each record's actual source-review date.
6. The highest-ranked active perk is selected deterministically. Anna's take can only explain that selection; no other tool or Agent session is granted to it.

The next click repeats the download, even in the same already-open app. There is no persisted catalog cache, no idle background polling, and no bundled fallback. A failed download or rejected catalog clears old results and displays a retry message. A valid empty catalog produces zero results. Upstream GitHub publication/CDN propagation may introduce a short delay.

## Security boundaries

- The only new browser network origin is `https://raw.githubusercontent.com`, explicitly declared in `ui.bundle.external_origins`. Anna adds this to the bundle CSP. The code fixes the repository/path; neither user input nor the catalog can choose another endpoint or redirect it.
- No profile, Anna token, API key, cookie, or persistent user identifier is sent to GitHub. GitHub receives the normal public-file request metadata (including the requesting IP/browser) and a time-only cache parameter. The profile remains on the existing Anna tool/LLM/storage path.
- Remote data cannot contain extra schema fields, executable code fields, arbitrary manifests, prompts, plugins, or permissions. Validation rejects unsupported schema versions, duplicate IDs/properties, malformed dates/types, invalid references, non-finite numbers, excessive size/count, and non-HTTPS/credential-bearing source links.
- The matcher does not fetch URLs, import remote modules, evaluate scripts, execute shell commands, or write remote content as code. It has no catalog disk cache. All algorithm and validation code stays inside the versioned, reviewed binary.
- Remote text is escaped before HTML rendering. Source links open only on a user click with `noopener noreferrer`. Strings sent to the LLM are explicitly treated as data, and the LLM has no tools or Agent session.
- Repository maintainers remain trusted for factual accuracy. Schema validation enforces shape and rendering boundaries; it cannot prove that a benefit is true. Human source verification and the visible verification dates remain necessary.

The origin declaration follows Anna's [UI manifest/CSP specification](https://anna.partners/developers/apps/app-ui-manifest). Permission declarations otherwise remain unchanged; `agent.session.auto` and fixed Agent access stay disabled.

## Catalog-only operation and compatibility

For a new, changed, expired, or removed perk, update only the catalog file, its revision/timestamp, and relevant source-review metadata; validate, commit, and push. No binary build, `apps push`, `apps cut`, installation, or App review is required for data-only edits within schema 1. A separate data-validation workflow checks those edits.

Existing v0.1.5 users first need the v0.1.6 code update to gain this mechanism. Once v0.1.6 is installed, subsequent catalog changes are independent of the installed App and Executa versions. Changes to the endpoint, executable logic, or supported schema would require a reviewed code release.

See [catalog maintenance](CATALOG_MAINTENANCE.md) for the human review cadence and roadmap.

## Verification

- Regression tests pass two different catalog revisions into the same matcher and assert that added entries appear, removed/expired entries disappear, and English/Japanese terms change.
- The 4OS binary build smoke test performs the same two-revision exercise in one unchanged packaged process.
- Fetch tests verify the fixed endpoint, per-search refresh, no credentials/profile leakage, timeout, strict UTF-8, media type/size limits, and no stale fallback.
- Schema tests cover malformed data, unsupported schemas, duplicate properties/IDs, unsafe links, and empty catalogs.
- Prior score-ordering, tie-break, uncertain-availability, Codédex encoding, and explanation-only LLM regressions remain covered.
