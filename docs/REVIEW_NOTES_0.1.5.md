# Anna review response: v0.1.5

## 1. Permission declarations

The UI calls only:

- `tools.invoke` for the bundled matcher;
- `llm.complete` for a short explanation of the already-selected result;
- `storage.set` for the last profile; and
- `window.set_title`.

The manifest now grants only those calls. The unused `storage.read` / `storage.get` declarations were removed. The Agent ACL explicitly sets `session.auto` to `false`, `session.fixed` to `null`, and `tools` to an empty list because the app never calls `anna.agent.session(...)`.

This follows Anna's separation between the `llm.complete` grant and the independent Agent session grant:

- <https://anna.partners/developers/apps/llm-and-agent>
- <https://anna.partners/developers/apps/app-manifest>
- <https://anna.partners/developers/apps/app-ui-manifest>

## 2. Codédex encoding

The four affected catalog fields now contain the correct UTF-8 `Codédex` spelling. The tracked catalog snapshot was corrected as well. Automated checks reject a BOM, invalid UTF-8, `Cod?dex`, or the Unicode replacement character, and the packaged binary smoke test verifies the returned title, provider, value, and reason.

## 3. Anna's take ordering

The matcher now selects the recommendation before the LLM is called.

Ranking order is deterministic:

1. displayed match score, descending;
2. unclamped engine score, descending;
3. catalog value score, descending; and
4. perk ID, ascending.

Offers marked `availability: check` are never selected for Anna's take. The UI sends only the selected perk to `llm.complete`, and the prompt limits the LLM to explaining that perk. The selected title and score are rendered from the matcher response, so generated text cannot replace the recommendation.

Regression tests cover the review case in which 99% AWS/GitHub matches must beat a 90% Google match, the tie-break order, uncertain availability, the live result contract, and the UI explanation prompt.

## 4–5. Catalog and differentiation

The maintenance model, validation cadence, expiry handling, and return-use roadmap are documented in [Catalog maintenance and product edge](CATALOG_MAINTENANCE.md).
