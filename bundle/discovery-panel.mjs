import { DiscoveryController } from "./discovery.mjs";

const COPY = {
  en: {
    title: "Explore beyond the catalog", intro: "Use Anna to find recent pages from selected official sources. These are discovery candidates, not verified offers or eligibility decisions.",
    topic: "Area", ai: "AI offers", coding: "Developer tools", cloud: "Cloud credits", research: "Research programs",
    period: "Search window", week: "Past week", month: "Past month", year: "Past year", any: "Any time",
    dateNote: "The time window guides the search provider; pages without a reliable publication date are labeled. It is not an offer-expiry filter.",
    consent: "Allow this search to use Anna Web credits and send selected country, role and topic terms to Anna's search provider. No LLM is used. Page retrieval also uses credits.",
    search: "Find latest candidates with Anna", busy: "Anna is checking…", empty: "No matching pages from the selected sources were returned. This does not mean no offers exist.",
    first: "Choose an area and search when you need more possibilities. Nothing runs automatically.",
    unverified: "UNVERIFIED CANDIDATE", noDate: "Publication date unknown", published: "Page date", retrieved: "Search retrieved",
    open: "Open source", fetch: "Read source with Anna", sourceText: "Retrieved text — conditions still need checking", truncated: "Partial page: do not assume missing conditions do not apply.",
    check: "Before applying, check region, eligibility, deadline, payment method and renewal terms with the provider.",
    grant_required: "Enable Web search/fetch for AI Perk Radar in Anna's permissions, then retry. No permission was enabled automatically.",
    search_failed: "Anna could not complete this search. The verified catalog is still available. No previous results are presented as fresh.",
    page_failed: "The page could not be safely read. Open the source directly; no eligibility or availability was confirmed.",
    conditions_changed: "Your conditions changed. Run a new search to see relevant candidates.",
    savedWarning: "This search could not be remembered. The results below are still available in this window.",
    usage: "Last web operation", units: "Anna CU", query: "Search terms", restored: "Saved search results; not a fresh page check.", found: "candidate pages found", sourceLoaded: "Source text retrieved. Eligibility remains unverified.",
  },
  ja: {
    title: "カタログの外にも探しに行く", intro: "Annaで、選択した公式サイトの新しい情報を探します。ここに出るのは未確認の候補で、利用資格や特典の有効性を保証するものではありません。",
    topic: "分野", ai: "AIの特典", coding: "開発者ツール", cloud: "クラウド利用枠", research: "研究者向け支援",
    period: "検索対象の期間", week: "過去1週間", month: "過去1か月", year: "過去1年", any: "期間指定なし",
    dateNote: "期間は検索サービスへの指定です。公開日が不明なページもあります。特典の申込期限による絞り込みではありません。",
    consent: "Anna Webの利用枠を使い、選択した国・属性・分野を検索サービスに送ることに同意します。LLMは使用しません。本文取得にも利用枠を使います。",
    search: "Annaで最新の候補を探す", busy: "Annaが確認中…", empty: "指定した公式サイトから候補が返りませんでした。特典が存在しないという意味ではありません。",
    first: "分野を選び、候補を広げたいときに検索できます。自動では実行しません。",
    unverified: "未確認の候補", noDate: "公開日不明", published: "ページの公開日", retrieved: "検索結果の取得日時",
    open: "提供元のページを開く", fetch: "Annaで本文を読む", sourceText: "取得した本文 — 利用条件は要確認", truncated: "本文の一部のみです。記載されていない条件がないとは判断できません。",
    check: "申込前に、対象地域・資格・期限・支払方法・自動更新の条件を提供元で確認してください。",
    grant_required: "Annaのアプリ権限でAI Perk RadarのWeb検索・取得を許可してから再試行してください。権限は自動で有効にしていません。",
    search_failed: "Annaで検索を完了できませんでした。確認済みカタログは引き続き使えます。前の結果を最新として表示することはありません。",
    page_failed: "本文を安全に取得できませんでした。提供元のページで直接確認してください。利用資格や提供状況の確認は行えていません。",
    conditions_changed: "条件が変わりました。現在の条件でもう一度検索してください。",
    savedWarning: "検索結果を保存できませんでした。この画面では引き続き閲覧できます。",
    usage: "直前のWeb操作", units: "Anna CU", query: "検索語", restored: "保存された検索結果です。ページを再確認した結果ではありません。", found: "件の候補ページが見つかりました", sourceLoaded: "本文を取得しました。利用資格の確認はまだ必要です。",
  },
};
const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function mountDiscovery({ root, anna, storage, getProfile, getLanguage }) {
  let options = { topic: "ai", period: "month" }, consent = false, restored = true;
  const text = () => COPY[getLanguage()] ?? COPY.en;
  const controller = new DiscoveryController({ web: anna.web, storage, getContext: () => ({ profile: getProfile(), options }),
    restoreOptions: value => { options = value; }, changed: render });
  function render() {
    const t = text(), state = controller.state;
    const active = document.activeElement;
    const hadFocus = root.contains(active);
    const focusSelector = active?.matches?.("[data-discovery-search]") ? "[data-discovery-search]"
      : active?.matches?.("[data-read-source]") ? `[data-read-source="${Number(active.dataset.readSource)}"]` : null;
    const choices = (items, selected) => items.map(value => `<option value="${value}" ${value === selected ? "selected" : ""}>${escape(t[value])}</option>`).join("");
    const rows = state?.results.map((item, i) => {
      const page = controller.pages.get(item.url);
      return `<article class="perk discovery-card"><span class="candidate-badge">${escape(t.unverified)}</span>
        <h3>${escape(item.title)}</h3><p class="provider">${escape(new URL(item.url).hostname)} · ${escape(item.published_at ? t.published + ": " + item.published_at : t.noDate)}</p>
        <p>${escape(item.snippet)}</p><div class="card-actions"><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(t.open)}</a>
        <button class="quiet-button" type="button" data-read-source="${i}" ${!consent || controller.busy ? "disabled" : ""}>${escape(t.fetch)}</button></div>
        ${page ? `<details class="source-excerpt" open><summary>${escape(t.sourceText)}</summary><p class="discovery-help">${escape(page.fetched_at)}</p>${page.truncated ? `<p class="source-warning">${escape(t.truncated)}</p>` : ""}<pre>${escape(page.content)}</pre></details>` : ""}</article>`;
    }).join("") ?? "";
    root.innerHTML = `<h2>${escape(t.title)}</h2><p class="discovery-intro">${escape(t.intro)}</p>
      <div class="discovery-controls"><label>${escape(t.topic)}<select data-discovery-topic>${choices(["ai", "coding", "cloud", "research"], options.topic)}</select></label>
      <label>${escape(t.period)}<select data-discovery-period>${choices(["week", "month", "year", "any"], options.period)}</select></label></div>
      <p class="discovery-help">${escape(t.dateNote)}</p><label class="discovery-consent"><input type="checkbox" data-web-consent ${consent ? "checked" : ""}/><span>${escape(t.consent)}</span></label>
      <button class="discovery-search" type="button" data-discovery-search ${!consent || controller.busy ? "disabled" : ""}>${escape(controller.busy ? t.busy : t.search)}</button>
      <p class="discovery-status" tabindex="-1" role="status" aria-live="polite">${escape(controller.error ? t[controller.error] : controller.busy ? t.busy : state ? state.results.length ? controller.pages.size ? t.sourceLoaded : `${state.results.length} ${t.found}` : t.empty : t.first)}</p>
      ${controller.saveFailed ? `<p>${escape(t.savedWarning)}</p>` : ""}
      ${controller.quota !== null ? `<p class="discovery-help">${escape(t.usage)}: ${controller.quota} ${escape(t.units)}</p>` : ""}
      ${state ? `<p class="discovery-help">${escape(t.retrieved)}: ${escape(state.fetched_at)}${restored ? " · " + escape(t.restored) : ""}</p><details class="discovery-query"><summary>${escape(t.query)}</summary><p>${escape(state.query)}</p></details>` : ""}
      <div class="discovery-results">${rows}</div><p class="discovery-help">${escape(t.check)}</p>`;
    if (hadFocus && focusSelector) {
      const control = root.querySelector(focusSelector);
      (control && !control.disabled ? control : root.querySelector(".discovery-status"))?.focus({ preventScroll: true });
    }
  }
  root.addEventListener("change", event => {
    if (event.target.matches("[data-web-consent]")) {
      consent = event.target.checked; render(); root.querySelector("[data-web-consent]").focus();
    } else if (event.target.matches("[data-discovery-topic], [data-discovery-period]")) {
      const field = event.target.matches("[data-discovery-topic]") ? "topic" : "period";
      options = { ...options, [field]: event.target.value }; controller.invalidate(); root.querySelector(`[data-discovery-${field}]`).focus();
    }
  });
  root.addEventListener("click", async event => {
    if (event.target.closest("[data-discovery-search]")) {
      restored = false; await controller.search(consent);
      if (document.activeElement === document.body || root.contains(document.activeElement)) root.querySelector(".discovery-status").focus({ preventScroll: true });
    }
    const read = event.target.closest("[data-read-source]");
    if (read) { const item = controller.state?.results[Number(read.dataset.readSource)]; if (item) await controller.fetchPage(item.url, consent);
      if (document.activeElement === document.body || root.contains(document.activeElement)) root.querySelector(".discovery-status").focus({ preventScroll: true }); }
  });
  render(); void controller.restore();
  return { render, profileChanged: () => controller.invalidate() };
}
