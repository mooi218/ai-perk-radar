// Only this reviewed endpoint is fetched. Remote content is JSON data, never code.
export const CATALOG_URL = "https://raw.githubusercontent.com/mooi218/ai-perk-radar/main/executas/ai-perk-radar/ai_perk_radar/opportunities.json";
export const MAX_CATALOG_BYTES = 256 * 1024;
export const CATALOG_TIMEOUT_MS = 10000;

export async function fetchCatalog(fetchImpl = globalThis.fetch, timeoutMs = CATALOG_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    // A time-only cache key also avoids serving a previous GitHub CDN response.
    const response = await fetchImpl(`${CATALOG_URL}?refresh=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || response.redirected) throw new Error("catalog_http_error");
    if (Number(response.headers.get("content-length")) > MAX_CATALOG_BYTES) {
      throw new Error("catalog_too_large");
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim();
    if (!["application/json", "text/plain"].includes(type)) throw new Error("catalog_content_type");
    if (!response.body) throw new Error("catalog_empty_body");
    reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let size = 0;
    let text = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CATALOG_BYTES) throw new Error("catalog_too_large");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    // The Executa validates the entire schema before ranking or returning text.
    if (!text || text.startsWith("\uFEFF")) throw new Error("catalog_invalid_encoding");
    return text;
  } finally {
    clearTimeout(timer);
    if (reader) await reader.cancel().catch(() => {});
  }
}

export function localizedField(perk, language, field, fallback = "") {
  return perk.localizations?.[language]?.[field] ?? fallback;
}
