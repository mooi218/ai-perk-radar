import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_URL, MAX_CATALOG_BYTES, fetchCatalog, localizedField } from "../bundle/catalog.mjs";

const response = (text, headers = {}) => new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", ...headers } });

test("every search downloads only the fixed JSON endpoint without credentials or profile", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return response(`{"revision":${calls.length}}`);
  };
  assert.equal(await fetchCatalog(fetcher), '{"revision":1}');
  assert.equal(await fetchCatalog(fetcher), '{"revision":2}');
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, CATALOG_URL);
    assert.match(parsed.search, /^\?refresh=\d+$/);
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
  }
});

test("rejects oversized, malformed UTF-8, BOM, wrong media type, and failed HTTP", async () => {
  const cases = [
    () => response("x", { "content-length": String(MAX_CATALOG_BYTES + 1) }),
    () => response("x".repeat(MAX_CATALOG_BYTES + 1)),
    () => response(new Uint8Array([0xC3, 0x28])),
    () => response("\uFEFF{}"),
    () => response("<html>error</html>", { "content-type": "text/html" }),
    () => new Response("missing", { status: 404 }),
  ];
  for (const make of cases) await assert.rejects(fetchCatalog(async () => make()));
});

test("aborts an unavailable catalog and never serves the previous response", async () => {
  let aborted = false;
  const hanging = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("timeout")); });
  });
  await assert.rejects(fetchCatalog(hanging, 10));
  assert.equal(aborted, true);
  assert.equal(await fetchCatalog(async () => response("fresh")), "fresh");
  await assert.rejects(fetchCatalog(async () => { throw new Error("offline"); }));
});

test("Japanese values and warnings update with each record; missing translation preserves current facts", () => {
  const perk = { caution: "Current warning", localizations: { ja: { value_display: "新しい内容" } } };
  assert.equal(localizedField(perk, "ja", "value_display"), "新しい内容");
  assert.equal(localizedField(perk, "ja", "caution", perk.caution), "Current warning");
});
