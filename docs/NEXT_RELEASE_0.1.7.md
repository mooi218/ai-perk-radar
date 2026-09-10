# v0.1.7 working draft

This draft builds on v0.1.6's independent JSON delivery. The v0.1.6 review candidate is preserved; this draft is not a newly submitted or publicly released App version.

## Product changes

- **Saved perks:** toggle a saved label on a card or recommendation. On the next search, use current catalog facts. Removed, expired, and currently non-matching saved entries are labeled explicitly. Before a refresh, only the saved name and a prompt to check current availability appear.
- **Return visits:** New since last visit, Changed, Ending within 30 days, and Newly for you views. The first successful search creates a baseline. Comparisons remain stable within the current session, while the latest successful snapshot is stored for the next visit.
- **Material changes:** compare source facts, eligibility, value, deadline, availability, source URL, and translations. Verification dates, ranking scores, field ordering, and catalog publication timestamps do not generate false change notifications.
- **Discovery controls:** accent-insensitive name/provider search, English/Japanese content search, offer-type filtering, recently-verified filtering, and combined view counters. Filters preserve matcher ordering.
- **Remembered preferences:** restore the user's prior profile and language. Profile controls collapse after a successful search, leaving room for results and a separate refresh button.
- **Optional Anna explanation:** deterministic matching is shown immediately. The user can request a short explanation of the selected result; failures retain the verified matching reason. A late response cannot overwrite a newer search or language choice.
- **Accessibility:** visible keyboard focus, labeled search/type controls, pressed states, status notices, and a layout checked at the App's minimum width.

## Data expansion

Catalog revision `2026-09-11.3` adds 20 entries, increasing the catalog from 25 to 45. All new records have official sources and Japanese details; they remain compatible with the released schema-1 matcher.

Ten student offers: DataCamp, Educative, Frontend Masters, Boot.dev, Appwrite, MongoDB Atlas student credits, Datadog, Namecheap, GitKraken, and Clerk. Source: [GitHub Student Developer Pack](https://education.github.com/pack/).

Ten general free tiers: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Google Colab](https://research.google.com/colaboratory/faq.html), [Hugging Face Static Spaces](https://huggingface.co/docs/hub/spaces-overview), [Qdrant Cloud](https://qdrant.tech/documentation/cloud/create-cluster/), [Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [PostHog](https://posthog.com/pricing), [Streamlit Community Cloud](https://docs.streamlit.io/deploy/streamlit-community-cloud), [Cloudinary](https://cloudinary.com/documentation/billing_and_plans), [Upstash Redis](https://upstash.com/pricing/redis), and [GitHub Codespaces](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces).

Existing Google AI Plus, AWS Student Rewards, Claude Team for scientists, and GitHub Copilot Student records were rechecked. The update clarifies payment/automatic renewal, enrollment and badge requirements, principal-investigator qualification, and the distinction between student approval and Copilot activation. Other source dates were preserved. Source-review dates use UTC.

## Storage and security

The only additional App permission is read access to the App's own Anna storage bucket (`storage.read` / `host_api.storage: get`). No cross-App/user-global bucket access, new external origin, token, or Agent session is added.

Four keys hold profile, language, saved labels, and visit metadata. The visit snapshot stores SHA-256 fingerprints rather than full offer text, and all current terms still come from a newly downloaded, validated catalog. Saved writes re-read/rebase the current APS row and retry etag conflicts; writes within one window are serialized. Failed saves are surfaced instead of being reported as successful.

## Runtime reliability

The v0.1.7 Executa explicitly reads and writes UTF-8. A Windows legacy test showed that raw Japanese JSON could be interpreted using a local codepage, while escaped JSON worked. The fix removes that dependency. Malformed JSON or a non-object request now returns a protocol error and does not terminate the process.

The build smoke test now sends unescaped UTF-8 through the packaged executable. The catalog schema, matching weights, and deterministic recommendation order are unchanged.

## Verification

- 14 Node tests cover fetch/security, recommendation scope, visit baselines, material changes, newly matching eligibility, date boundaries, combined filtering, saved availability, etag conflict handling, and malformed stored preferences.
- 13 Python tests cover catalog validation, ranking/encoding, data-only refresh, and raw UTF-8 protocol recovery under a simulated Windows codepage.
- The expanded catalog was accepted by the already-built v0.1.6 executable (45 entries; 44 matches for the student/developer profile; AWS99%).
- The real bundle was tested in a local Anna-API harness with actual matching and public JSON fetching: save/reload/language restoration, a profile change producing 26 newly matching student offers, seeded New/Changed/For-you scenarios, and 420px layout without horizontal overflow. Local harness storage/LLM responses are test substitutes, not proof of a production LLM completion.

Before releasing this draft after the current review, confirm the intended App/Executa versions and run the normal Anna install/upgrade verification described in the v0.1.6 notes.

## Anna working-draft verification

The v0.1.7 matcher was built for all four OSs in [run 34503782081](https://github.com/mooi218/ai-perk-radar/actions/runs/34503782081). Archive hashes, entrypoints and executable permissions were checked, and the packaged Windows executable accepted the live 45-entry catalog as raw UTF-8. The registered Executa version is ID469.

The working App draft (revision8, six UI files) was installed in the developer's Anna account and tested with the actual host APIs. Prior profile restoration succeeded, the expanded catalog returned44 matches for the student/developer profile, and a saved Codédex entry survived reopening. The temporary saved item was then removed, restoring the initially empty saved list.

On-demand Anna explanations were verified in both English and Japanese, with AWS Student Rewards remaining the99% selected recommendation. Small output budgets sometimes returned a valid response envelope with no displayable text; a2048-token cap successfully produced the requested short explanation in this environment. Empty/error replies still retain the deterministic reason and show a retry notice. Diagnostic logs contain response field names/status/usage only, not profile data or generated text.

No App v0.1.7 cut or review submission was made. The existing App v0.1.6 review candidate remains in place, while the developer can use the working draft for further testing.
