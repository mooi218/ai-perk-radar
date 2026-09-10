import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
import { buildRecommendationPrompt } from "./recommendation.mjs";
import { fetchCatalog, localizedField } from "./catalog.mjs";

const EXECUTA_HANDLE = "matcher";

const TOOL_ID =
  (
    typeof window !== "undefined" &&
    window.__ANNA_TOOL_IDS__ &&
    window.__ANNA_TOOL_IDS__[EXECUTA_HANDLE]
  ) ||
  "tool-dev-ai-perk-radar";
const INITIAL_LIMIT = 5;

const byId = (id) => document.getElementById(id);

let currentResults = [];
let currentAiTake = "";
let currentRecommendation = null;
let currentAiExplained = false;
let currentLanguage = "en";
let currentCatalog = null;
let currentError = false;
let scanning = false;

let exclusiveLimit = INITIAL_LIMIT;
let freeLimit = INITIAL_LIMIT;

const TEXT = {
  en: {
    eyebrow: "Fresh opportunities / verified sources",
    hero: "Find the perks you're actually eligible for.",
    lead:
      "AI subscriptions, developer credits, student plans and early programs. Tell the radar who you are and it will rank the best current opportunities.",

    country: "Country",
    japan: "Japan",
    outsideJapan: "Outside Japan",

    priority: "What matters most?",
    freeFirst: "Free first",
    biggestValue: "Biggest value",
    expiringSoon: "Expiring soon",

    youAre: "You are",
    student: "University student",
    researcher: "Researcher / lab member",
    developer: "Developer",
    creator: "Creator",
    founder: "Founder / builder",

    interested: "Interested in",
    ai: "AI",
    coding: "Coding",
    cloud: "Cloud",
    research: "Research",

    limited: "Show only time-limited offers",
    find: "Find my perks",

    ready: "Ready.",
    scanning: "Scanning current opportunities...",
    comparing: "Anna is explaining your top match...",
    aiReady: "AI recommendation ready.",
    updated: "Matches updated.",

    matches: "Your matches",
    eligible: "eligible",

    annaTake: "Anna's take",
    personalized: "Personalized recommendation",

    exclusive: "Exclusive perks",
    exclusiveDesc:
      "Student, research and limited-access benefits.",

    freeTools: "Free tools",
    freeToolsDesc:
      "Useful free tiers available without special eligibility.",

    value: "Value",
    deadline: "Deadline",
    freshness: "Freshness",

    studentBadge: "STUDENT",
    researchBadge: "RESEARCH",
    freeBadge: "FREE",
    newBadge: "NEW",
    bundleBadge: "BUNDLE",
    checkBadge: "CHECK AVAILABILITY",

    includedGithub:
      "Included in GitHub Student Developer Pack",

    headsUp: "Heads up",
    official: "Open official source",

    lastChecked: "Last checked",
    catalogChecked: "Catalog refreshed",
    catalogUnavailable: "The latest catalog could not be loaded. Check your connection and try Find my perks again.",

    showMore: "Show more",
    showLess: "Show less",

    noMatches:
      "No strong matches yet. Try changing your filters.",

    switchLanguage: "\u65e5\u672c\u8a9e",
  },

  ja: {
    eyebrow: "\u6700\u65b0\u7279\u5178 / \u516c\u5f0f\u60c5\u5831\u3092\u78ba\u8a8d\u6e08\u307f",
    hero: "\u3042\u306a\u305f\u304c\u672c\u5f53\u306b\u4f7f\u3048\u308b\u7279\u5178\u3092\u898b\u3064\u3051\u307e\u3059\u3002",
    lead:
      "AI\u3001\u958b\u767a\u8005\u5411\u3051\u30af\u30ec\u30b8\u30c3\u30c8\u3001\u5b66\u751f\u30d7\u30e9\u30f3\u3001\u671f\u9593\u9650\u5b9a\u30ad\u30e3\u30f3\u30da\u30fc\u30f3\u304b\u3089\u3001\u6761\u4ef6\u306b\u5408\u3046\u3082\u306e\u3092\u512a\u5148\u3057\u3066\u8868\u793a\u3057\u307e\u3059\u3002",

    country: "\u56fd\u30fb\u5730\u57df",
    japan: "\u65e5\u672c",
    outsideJapan: "\u65e5\u672c\u4ee5\u5916",

    priority: "\u4f55\u3092\u512a\u5148\u3059\u308b\uff1f",
    freeFirst: "\u7121\u6599\u3092\u512a\u5148",
    biggestValue: "\u304a\u5f97\u5ea6\u3092\u512a\u5148",
    expiringSoon: "\u7d42\u4e86\u304c\u8fd1\u3044\u3082\u306e\u3092\u512a\u5148",

    youAre: "\u3042\u306a\u305f\u306b\u3064\u3044\u3066",
    student: "\u5927\u5b66\u751f",
    researcher: "\u7814\u7a76\u8005\u30fb\u7814\u7a76\u5ba4\u6240\u5c5e",
    developer: "\u958b\u767a\u8005",
    creator: "\u30af\u30ea\u30a8\u30a4\u30bf\u30fc",
    founder: "\u500b\u4eba\u958b\u767a\u30fb\u8d77\u696d",

    interested: "\u8208\u5473\u306e\u3042\u308b\u5206\u91ce",
    ai: "AI",
    coding: "\u30d7\u30ed\u30b0\u30e9\u30df\u30f3\u30b0",
    cloud: "\u30af\u30e9\u30a6\u30c9",
    research: "\u7814\u7a76",

    limited: "\u671f\u9593\u9650\u5b9a\u306e\u7279\u5178\u3060\u3051\u8868\u793a",
    find: "\u4f7f\u3048\u308b\u7279\u5178\u3092\u63a2\u3059",

    ready: "\u6e96\u5099\u5b8c\u4e86",
    scanning: "\u5229\u7528\u3067\u304d\u308b\u7279\u5178\u3092\u691c\u7d22\u4e2d...",
    comparing: "Annaが最上位の特典を説明しています...",
    aiReady: "AI\u306e\u304a\u3059\u3059\u3081\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002",
    updated: "\u691c\u7d22\u7d50\u679c\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002",

    matches: "\u3042\u306a\u305f\u3078\u306e\u304a\u3059\u3059\u3081",
    eligible: "\u4ef6\u304c\u5bfe\u8c61",

    annaTake: "Anna\u306e\u304a\u3059\u3059\u3081",
    personalized: "\u6761\u4ef6\u306b\u5408\u308f\u305b\u305fAI\u63a8\u85a6",

    exclusive: "\u9650\u5b9a\u7279\u5178",
    exclusiveDesc:
      "\u5b66\u751f\u30fb\u7814\u7a76\u8005\u30fb\u671f\u9593\u9650\u5b9a\u306a\u3069\u3001\u5bfe\u8c61\u8005\u304c\u9650\u3089\u308c\u308b\u7279\u5178\u3067\u3059\u3002",

    freeTools: "\u7121\u6599\u30c4\u30fc\u30eb",
    freeToolsDesc:
      "\u7279\u5225\u306a\u8cc7\u683c\u304c\u306a\u304f\u3066\u3082\u5229\u7528\u3067\u304d\u308b\u7121\u6599\u67a0\u3067\u3059\u3002",

    value: "\u7279\u5178\u5185\u5bb9",
    deadline: "\u671f\u9650",
    freshness: "\u65b0\u3057\u3055",

    studentBadge: "\u5b66\u751f",
    researchBadge: "\u7814\u7a76\u8005",
    freeBadge: "\u7121\u6599",
    newBadge: "\u65b0\u7740",
    bundleBadge: "\u30bb\u30c3\u30c8",
    checkBadge: "\u8981\u78ba\u8a8d",

    includedGithub:
      "GitHub Student Developer Pack\u306b\u542b\u307e\u308c\u308b\u7279\u5178\u3067\u3059",

    headsUp: "\u6ce8\u610f",
    official: "\u516c\u5f0f\u60c5\u5831\u3092\u898b\u308b",

    lastChecked: "\u6700\u7d42\u78ba\u8a8d",
    catalogChecked: "最新カタログ取得",
    catalogUnavailable: "最新カタログを取得できませんでした。通信を確認して「使える特典を探す」を押してください。",

    showMore: "\u3082\u3063\u3068\u898b\u308b",
    showLess: "\u9589\u3058\u308b",

    noMatches:
      "\u6761\u4ef6\u306b\u5408\u3046\u7279\u5178\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6761\u4ef6\u3092\u5909\u66f4\u3057\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002",

    switchLanguage: "English",
  },
};





function localizedValue(perk) {
  if (currentLanguage !== "ja") {
    return perk.value_display;
  }

  return localizedField(perk, currentLanguage, "value_display", perk.value_display);
}


function localizedDeadline(perk) {
  if (currentLanguage !== "ja") {
    return perk.deadline_display;
  }

  if (!perk.deadline_raw) {
    return "\u671f\u9650\u306a\u3057";
  }

  return formatDate(perk.deadline_raw);
}


function localizedFreshness(perk) {
  if (currentLanguage !== "ja") {
    return perk.freshness;
  }

  const map = {
    "Just launched": "\u767b\u5834\u3057\u305f\u3070\u304b\u308a",
    "New": "\u65b0\u7740",
    "Recent": "\u6700\u8fd1\u8ffd\u52a0",
    "Current": "\u73fe\u5728\u5229\u7528\u53ef\u80fd",
    "Established": "\u7d99\u7d9a\u63d0\u4f9b\u4e2d"
  };

  return map[perk.freshness]
    || perk.freshness;
}


function localizedReason(perk) {
  if (currentLanguage !== "ja") {
    return perk.why;
  }

  return localizedField(perk, currentLanguage, "reason", perk.why);
}


function localizedCaution(perk) {
  if (currentLanguage !== "ja") {
    return perk.caution || "";
  }

  return localizedField(perk, currentLanguage, "caution", perk.caution || "");
}


function t(key) {
  return TEXT[currentLanguage][key];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (!value) {
    return currentLanguage === "ja"
      ? "\u672a\u78ba\u8a8d"
      : "Unknown";
  }

  const date = new Date(value + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (currentLanguage === "ja") {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }
    ).format(date);
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function setStaticText() {
  document.documentElement.lang =
    currentLanguage === "ja" ? "ja" : "en";

  const languageBtn = byId("language-btn");

  if (languageBtn) {
    languageBtn.textContent =
      t("switchLanguage");
  }

  const eyebrow =
    document.querySelector(".eyebrow");

  if (eyebrow) {
    eyebrow.innerHTML =
      '<span class="dot"></span>' +
      escapeHtml(t("eyebrow"));
  }

  const hero =
    document.querySelector(".shell > h1");

  if (hero) {
    hero.textContent = t("hero");
  }

  const lead =
    document.querySelector(".lead");

  if (lead) {
    lead.textContent = t("lead");
  }

  const fieldLabels =
    document.querySelectorAll(".field-label");

  if (fieldLabels[0]) {
    fieldLabels[0].textContent =
      t("country");
  }

  if (fieldLabels[1]) {
    fieldLabels[1].textContent =
      t("priority");
  }

  const country = byId("country");

  if (country?.options?.[0]) {
    country.options[0].textContent =
      t("japan");
  }

  if (country?.options?.[1]) {
    country.options[1].textContent =
      t("outsideJapan");
  }

  const priority = byId("priority");

  if (priority?.options?.[0]) {
    priority.options[0].textContent =
      t("freeFirst");
  }

  if (priority?.options?.[1]) {
    priority.options[1].textContent =
      t("biggestValue");
  }

  if (priority?.options?.[2]) {
    priority.options[2].textContent =
      t("expiringSoon");
  }

  const legends =
    document.querySelectorAll("legend");

  if (legends[0]) {
    legends[0].textContent =
      t("youAre");
  }

  if (legends[1]) {
    legends[1].textContent =
      t("interested");
  }

  const setChip = (id, value) => {
    const input = byId(id);
    const span =
      input?.parentElement?.querySelector("span");

    if (span) {
      span.textContent = value;
    }
  };

  setChip("student", t("student"));
  setChip("researcher", t("researcher"));
  setChip("developer", t("developer"));
  setChip("creator", t("creator"));
  setChip("founder", t("founder"));

  const interests = {
    ai: t("ai"),
    coding: t("coding"),
    cloud: t("cloud"),
    research: t("research"),
    creator: t("creator"),
  };

  document
    .querySelectorAll('input[name="interest"]')
    .forEach((input) => {
      const span =
        input.parentElement?.querySelector("span");

      if (span && interests[input.value]) {
        span.textContent =
          interests[input.value];
      }
    });

  const limited =
    byId("limited-only")
      ?.parentElement
      ?.querySelector("span");

  if (limited) {
    limited.textContent =
      t("limited");
  }

  const findBtn = byId("find-btn");

  if (findBtn) {
    findBtn.textContent =
      t("find");
  }

  const resultsTitle =
    document.querySelector(
      ".results-head h2"
    );

  if (resultsTitle) {
    resultsTitle.textContent =
      t("matches");
  }

  if (!currentResults.length) {
    const empty =
      document.querySelector(
        "#results .empty"
      );

    if (empty) {
      empty.textContent =
        t("noMatches");
    }
  }

  renderResults();
}

function getProfile() {
  const interests = new Set(
    [
      ...document.querySelectorAll(
        'input[name="interest"]:checked'
      ),
    ].map((el) => el.value)
  );

  const developer =
    byId("developer")?.checked ?? false;

  const creator =
    byId("creator")?.checked ?? false;

  const founder =
    byId("founder")?.checked ?? false;

  if (developer) {
    interests.add("coding");
    interests.add("cloud");
  }

  if (creator) {
    interests.add("creator");
    interests.add("ai");
  }

  if (founder) {
    interests.add("ai");
    interests.add("coding");
    interests.add("cloud");
  }

  return {
    country: byId("country").value,
    student: byId("student").checked,
    researcher:
      byId("researcher").checked,
    developer,
    creator,
    founder,
    limited_only:
      byId("limited-only")?.checked
      ?? false,
    priority: byId("priority").value,
    interests: [...interests],
  };
}

function badgeHtml(perk) {
  const badges = [];

  if (perk.availability === "check") {
    badges.push(
      `<span class="perk-badge perk-badge-check">${escapeHtml(t("checkBadge"))}</span>`
    );
  }

  if (perk.offer_type === "bundle") {
    badges.push(
      `<span class="perk-badge perk-badge-bundle">${escapeHtml(t("bundleBadge"))}</span>`
    );
  }

  if (perk.student_required) {
    badges.push(
      `<span class="perk-badge">${escapeHtml(t("studentBadge"))}</span>`
    );
  }

  if (perk.researcher_required) {
    badges.push(
      `<span class="perk-badge">${escapeHtml(t("researchBadge"))}</span>`
    );
  }

  if (perk.free) {
    badges.push(
      `<span class="perk-badge">${escapeHtml(t("freeBadge"))}</span>`
    );
  }

  if (
    perk.freshness === "New" ||
    perk.freshness === "Just launched"
  ) {
    badges.push(
      `<span class="perk-badge perk-badge-new">${escapeHtml(t("newBadge"))}</span>`
    );
  }

  return badges.join("");
}

function cardHtml(perk) {
  const localizedCautionText = localizedCaution(perk);

  const caution = localizedCautionText
    ? `
      <div class="caution">
        <strong>${escapeHtml(t("headsUp"))}</strong>
        ${escapeHtml(localizedCautionText)}
      </div>
    `
    : "";

  const parent =
    perk.parent_id ===
    "github-student-developer-pack"
      ? `
        <div class="parent-note">
          ${escapeHtml(t("includedGithub"))}
        </div>
      `
      : "";

  const checked =
    perk.last_checked ||
    perk.verified_at;

  return `
    <article class="perk">
      <div class="perk-top">
        <div>
          <h3>${escapeHtml(perk.title)}</h3>

          <div class="provider">
            ${escapeHtml(perk.provider)}
          </div>

          <div class="perk-badges">
            ${badgeHtml(perk)}
          </div>
        </div>

        <div class="score">
          ${escapeHtml(perk.match_score)}% match
        </div>
      </div>

      ${parent}

      <div class="meta">
        <div class="meta-item">
          <span class="meta-label">
            ${escapeHtml(t("value"))}
          </span>

          <span class="meta-value">
            ${escapeHtml(localizedValue(perk))}
          </span>
        </div>

        <div class="meta-item">
          <span class="meta-label">
            ${escapeHtml(t("deadline"))}
          </span>

          <span class="meta-value">
            ${escapeHtml(localizedDeadline(perk))}
          </span>
        </div>

        <div class="meta-item">
          <span class="meta-label">
            ${escapeHtml(t("freshness"))}
          </span>

          <span class="meta-value">
            ${escapeHtml(localizedFreshness(perk))}
          </span>
        </div>
      </div>

      <p class="why">
        ${escapeHtml(localizedReason(perk))}
      </p>

      ${caution}

      <div class="checked-row">
        <a
          href="${escapeHtml(perk.source_url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(t("official"))}
        </a>

        <span class="checked-date">
          ${escapeHtml(t("lastChecked"))}:
          ${escapeHtml(formatDate(checked))}
        </span>
      </div>
    </article>
  `;
}

function sectionHtml(
  title,
  description,
  items,
  limit,
  sectionName
) {
  if (!items.length) {
    return "";
  }

  const visible =
    items.slice(0, limit);

  const button =
    items.length > INITIAL_LIMIT
      ? `
        <button
          class="show-more"
          data-section="${sectionName}"
        >
          ${
            limit < items.length
              ? t("showMore")
              : t("showLess")
          }
        </button>
      `
      : "";

  return `
    <section class="result-section">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
        </div>

        <span>${items.length}</span>
      </div>

      <div class="section-cards">
        ${visible.map(cardHtml).join("")}
      </div>

      ${button}
    </section>
  `;
}

function catalogStatusHtml() {
  if (!currentCatalog) return "";
  const refreshed = new Intl.DateTimeFormat(currentLanguage === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(currentCatalog.fetched_at));
  return `<div class="catalog-checked" data-catalog-revision="${escapeHtml(currentCatalog.revision)}">${escapeHtml(t("catalogChecked"))}: ${escapeHtml(refreshed)}</div>`;
}

function renderResults() {
  const container = byId("results");
  const count = byId("result-count");

  if (!container || !count) {
    return;
  }

  if (!currentResults.length) {
    count.textContent = "";

    container.innerHTML = catalogStatusHtml() +
      `<div class="empty">${escapeHtml(t(currentError ? "catalogUnavailable" : scanning ? "scanning" : "noMatches"))}</div>`;

    return;
  }

  const exclusive =
    currentResults.filter(
      (perk) =>
        perk.offer_type !== "free_tier"
    );

  const freeTools =
    currentResults.filter(
      (perk) =>
        perk.offer_type === "free_tier"
    );

  count.textContent =
    currentLanguage === "ja"
      ? `${currentResults.length}${t("eligible")}`
      : `${currentResults.length} ${t("eligible")}`;

  const catalogChecked = catalogStatusHtml();

  const aiCard = currentRecommendation
    ? `
      <article class="perk ai-take">
        <div class="perk-top">
          <div>
            <h3>${escapeHtml(t("annaTake"))}</h3>

            <div class="provider">
              ${escapeHtml(t("personalized"))}
              ·
              ${escapeHtml(currentRecommendation.title)}
            </div>
          </div>

          <div class="score">
            ${escapeHtml(currentRecommendation.match_score)}% match
          </div>
        </div>

        <p
          class="why"
          style="margin-top:16px"
        >
          ${escapeHtml(
            currentAiTake ||
            localizedReason(currentRecommendation)
          )}
        </p>
      </article>
    `
    : "";

  container.innerHTML =
    catalogChecked +
    aiCard +
    sectionHtml(
      t("exclusive"),
      t("exclusiveDesc"),
      exclusive,
      exclusiveLimit,
      "exclusive"
    ) +
    sectionHtml(
      t("freeTools"),
      t("freeToolsDesc"),
      freeTools,
      freeLimit,
      "free"
    );

  document
    .querySelectorAll(".show-more")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const section =
            button.dataset.section;

          if (section === "exclusive") {
            exclusiveLimit =
              exclusiveLimit < exclusive.length
                ? exclusive.length
                : INITIAL_LIMIT;
          }

          if (section === "free") {
            freeLimit =
              freeLimit < freeTools.length
                ? freeTools.length
                : INITIAL_LIMIT;
          }

          renderResults();
        }
      );
    });
}

function extractLlmText(reply) {
  if (!reply) return "";

  if (typeof reply === "string") {
    return reply;
  }

  if (
    typeof reply.content === "string"
  ) {
    return reply.content;
  }

  if (
    reply.content?.type === "text"
  ) {
    return reply.content.text || "";
  }

  if (Array.isArray(reply.content)) {
    return reply.content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return item?.text || "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof reply.text === "string") {
    return reply.text;
  }

  if (
    typeof reply.message?.content
      === "string"
  ) {
    return reply.message.content;
  }

  return "";
}

async function main() {
  const status = byId("status");
  const button = byId("find-btn");
  const languageBtn =
    byId("language-btn");

  let anna;

  try {
    anna =
      await AnnaAppRuntime.connect();
  } catch (error) {
    status.textContent =
      "Open this app from the Anna development harness.";

    button.disabled = true;
    return;
  }

  await anna.window.set_title({
    title: "AI Perk Radar",
  });

  languageBtn?.addEventListener(
    "click",
    () => {
      currentLanguage =
        currentLanguage === "en"
          ? "ja"
          : "en";

      if (
        currentRecommendation &&
        !currentAiExplained
      ) {
        currentAiTake = localizedReason(
          currentRecommendation
        );
      }

      setStaticText();

      if (!button.disabled) {
        status.textContent = t(currentError ? "catalogUnavailable" : "ready");
      }
    }
  );

  setStaticText();
  status.textContent = t("ready");

  button.addEventListener(
    "click",
    async () => {
      const profile = getProfile();

      button.disabled = true;

      exclusiveLimit =
        INITIAL_LIMIT;

      freeLimit =
        INITIAL_LIMIT;

      currentAiTake = "";
      currentRecommendation = null;
      currentAiExplained = false;
      currentResults = [];
      currentCatalog = null;
      currentError = false;
      scanning = true;
      renderResults();

      status.textContent =
        t("scanning");

      try {
        const catalogJson = await fetchCatalog();
        const fetchedAt = new Date().toISOString();
        const response =
          await anna.tools.invoke({
            tool_id: TOOL_ID,
            method: "find_perks",
            args: { ...profile, catalog_json: catalogJson },
          });

        const payload =
          response?.data ?? response;

        if (response?.success === false || !Array.isArray(payload?.results) || !payload?.catalog) {
          throw new Error("catalog_matching_failed");
        }
        currentCatalog = { ...payload.catalog, fetched_at: fetchedAt };

        currentResults =
          payload?.results ?? [];

        currentRecommendation =
          payload?.recommended ?? null;

        if (currentRecommendation) {
          currentAiTake = localizedReason(
            currentRecommendation
          );
        }

        renderResults();

        if (currentRecommendation) {
          status.textContent =
            t("comparing");

          try {
            const reply =
              await anna.llm.complete({
                systemPrompt:
                  "Explain the recommendation already selected by AI Perk Radar's matching engine. Do not select, rank, compare, or name another opportunity. Be concise, factual, and cautious.",

                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: buildRecommendationPrompt(
                        profile,
                        currentRecommendation,
                        currentLanguage === "ja"
                          ? "Japanese"
                          : "English"
                      ),
                    },
                  },
                ],

                maxTokens: 180,
                temperature: 0.2,
              });

            const explanation =
              extractLlmText(reply);

            if (explanation) {
              currentAiTake = explanation;
              currentAiExplained = true;
            }

          } catch (error) {
            console.warn(
              "LLM unavailable:",
              error
            );
          }
        }

        renderResults();

        await anna.storage.set({
          key:
            "ai-perk-radar:last-profile",
          value: profile,
        }).catch(error => console.warn("Profile could not be saved:", error));

        status.textContent =
          currentAiExplained
            ? t("aiReady")
            : t("updated");

      } catch (error) {
        console.error(error);
        currentError = true;
        currentCatalog = null;
        currentResults = [];
        currentRecommendation = null;
        currentAiTake = "";
        status.textContent = t("catalogUnavailable");

      } finally {
        scanning = false;
        renderResults();
        button.disabled = false;
      }
    }
  );
}

main();
