import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

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
let currentLanguage = "en";

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
    comparing: "Anna is comparing your best matches...",
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
    catalogChecked: "Catalog last checked",

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
    comparing: "Anna\u304c\u5019\u88dc\u3092\u6bd4\u8f03\u3057\u3066\u3044\u307e\u3059...",
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
    catalogChecked: "\u30c7\u30fc\u30bf\u6700\u7d42\u78ba\u8a8d",

    showMore: "\u3082\u3063\u3068\u898b\u308b",
    showLess: "\u9589\u3058\u308b",

    noMatches:
      "\u6761\u4ef6\u306b\u5408\u3046\u7279\u5178\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6761\u4ef6\u3092\u5909\u66f4\u3057\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002",

    switchLanguage: "English",
  },
};


const JA_DETAIL = {
  "google-ai-plus-student-2026": {
    value: "Google AI Plus\u309212\u304b\u6708\u7121\u6599",
    reason: "\u65e5\u672c\u306e\u5bfe\u8c61\u9ad8\u7b49\u6559\u80b2\u6a5f\u95a2\u306e\u5b66\u751f\u5411\u3051\u7279\u5178\u3067\u3059\u3002Google AI Plus\u309212\u304b\u6708\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u3001Gemini\u306e\u5229\u7528\u4e0a\u9650\u62e1\u5927\u3084400GB\u306e\u30b9\u30c8\u30ec\u30fc\u30b8\u304c\u542b\u307e\u308c\u307e\u3059\u3002"
  },

  "aws-student-rewards-2026": {
    value: "\u6700\u5927\u7d04579\u7c73\u30c9\u30eb\u76f8\u5f53",
    reason: "\u8a8d\u8a3c\u6e08\u307f\u306e\u5927\u5b66\u751f\u306fAWS Skill Builder Premium\u309212\u304b\u6708\u5229\u7528\u3067\u304d\u307e\u3059\u3002\u8ffd\u52a0\u30d0\u30c3\u30b8\u306e\u7372\u5f97\u3067AWS\u30af\u30ec\u30b8\u30c3\u30c8\u3084\u8cc7\u683c\u8a66\u9a13\u30d0\u30a6\u30c1\u30e3\u30fc\u3082\u89e3\u653e\u3067\u304d\u307e\u3059\u3002"
  },

  "zed-student-plan-2026": {
    value: "Pro 12\u304b\u6708 + \u6bce\u670810\u7c73\u30c9\u30eb\u306eAI\u30af\u30ec\u30b8\u30c3\u30c8",
    reason: "\u8a8d\u8a3c\u6e08\u307f\u306e\u5927\u5b66\u751f\u306fZed Pro\u30921\u5e74\u9593\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u3001\u6bce\u670810\u7c73\u30c9\u30eb\u5206\u306eAI\u30c8\u30fc\u30af\u30f3\u30af\u30ec\u30b8\u30c3\u30c8\u3082\u542b\u307e\u308c\u307e\u3059\u3002"
  },

  "anthropic-scientist-team-2026": {
    value: "Claude Team\u6a19\u6e96\u30b7\u30fc\u30c8\u309212\u304b\u6708\u7121\u6599",
    reason: "\u7814\u7a76\u8005\u5411\u3051\u306bClaude Team\u306e\u6a19\u6e96\u30b7\u30fc\u30c8\u30921\u5e74\u9593\u7121\u6599\u3067\u63d0\u4f9b\u3059\u308b\u30d7\u30ed\u30b0\u30e9\u30e0\u3067\u3059\u3002\u521d\u671f\u67a0\u306b\u306f\u4eba\u6570\u5236\u9650\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "github-copilot-student": {
    value: "\u8a8d\u8a3c\u6e08\u307f\u5b66\u751f\u306fGitHub Copilot\u3092\u7121\u6599\u5229\u7528",
    reason: "GitHub Education\u3067\u8a8d\u8a3c\u3055\u308c\u305f\u5b66\u751f\u5411\u3051\u306eCopilot\u7279\u5178\u3067\u3059\u3002\u5229\u7528\u958b\u59cb\u53ef\u5426\u306f\u73fe\u5728\u306eGitHub\u306e\u53d7\u4ed8\u72b6\u6cc1\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    caution: "GitHub Docs\u3067\u306f\u5b66\u751f\u5411\u3051\u7121\u6599\u5229\u7528\u304c\u6848\u5185\u3055\u308c\u3066\u3044\u307e\u3059\u304c\u3001\u65b0\u898f\u7533\u8fbc\u307f\u304c\u4e00\u6642\u505c\u6b62\u3055\u308c\u308b\u5834\u5408\u304c\u3042\u308b\u305f\u3081\u3001\u7533\u8fbc\u307f\u524d\u306b\u6700\u65b0\u72b6\u6cc1\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
  },

  "github-student-developer-pack": {
    value: "GitHub Pro + \u591a\u6570\u306e\u30d1\u30fc\u30c8\u30ca\u30fc\u7279\u5178",
    reason: "\u8a8d\u8a3c\u6e08\u307f\u5b66\u751f\u5411\u3051\u306bGitHub Pro\u3001\u958b\u767a\u30c4\u30fc\u30eb\u3001\u30af\u30e9\u30a6\u30c9\u30af\u30ec\u30b8\u30c3\u30c8\u3001\u5b66\u7fd2\u30b5\u30fc\u30d3\u30b9\u306a\u3069\u3092\u307e\u3068\u3081\u3066\u63d0\u4f9b\u3059\u308b\u30d1\u30c3\u30af\u3067\u3059\u3002"
  },

  "azure-for-students": {
    value: "100\u7c73\u30c9\u30eb\u306eAzure\u30af\u30ec\u30b8\u30c3\u30c8 + \u7121\u6599\u30b5\u30fc\u30d3\u30b9",
    reason: "\u5bfe\u8c61\u306e\u5927\u5b66\u751f\u306fAzure\u30af\u30ec\u30b8\u30c3\u30c8100\u7c73\u30c9\u30eb\u5206\u3068\u5bfe\u8c61\u30b5\u30fc\u30d3\u30b9\u306e\u7121\u6599\u67a0\u3092\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "jetbrains-student-pack": {
    value: "JetBrains IDE\u30fb.NET\u30c4\u30fc\u30eb\u3092\u7121\u6599\u5229\u7528",
    reason: "\u5b66\u751f\u306fJetBrains\u306eIDE\u3084.NET\u958b\u767a\u30c4\u30fc\u30eb\u306e\u6559\u80b2\u7528\u30e9\u30a4\u30bb\u30f3\u30b9\u3092\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002",
    caution: "\u6559\u80b2\u7528\u30e9\u30a4\u30bb\u30f3\u30b9\u306f\u5546\u7528\u76ee\u7684\u306b\u4f7f\u7528\u3067\u304d\u307e\u305b\u3093\u3002"
  },

  "figma-education": {
    value: "Professional\u76f8\u5f53\u306e\u6a5f\u80fd\u3092\u7121\u6599\u5229\u7528",
    reason: "\u5bfe\u8c61\u306e\u5b66\u751f\u306fFigma Education\u3092\u901a\u3058\u3066Professional\u30d7\u30e9\u30f3\u76f8\u5f53\u306e\u6a5f\u80fd\u3092\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "notion-education": {
    value: "\u5b66\u751f\u5411\u3051Education\u30d7\u30e9\u30f3\u3092\u7121\u6599\u5229\u7528",
    reason: "\u8a8d\u8b58\u3055\u308c\u305f\u5b66\u6821\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u6301\u3064\u5b66\u751f\u306fNotion\u306eEducation\u30d7\u30e9\u30f3\u3092\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "autodesk-education": {
    value: "Autodesk\u88fd\u54c1\u30921\u5e74\u9593\u7121\u6599\u5229\u7528",
    reason: "\u5bfe\u8c61\u306e\u5b66\u751f\u306fAutodesk\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2\u3084\u30b5\u30fc\u30d3\u30b9\u3092\u6559\u80b2\u7528\u9014\u30671\u5e74\u9593\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002",
    caution: "\u6559\u80b2\u7528\u30a2\u30af\u30bb\u30b9\u306f\u5546\u7528\u30fb\u8077\u696d\u7528\u30fb\u55b6\u5229\u76ee\u7684\u3067\u306f\u4f7f\u7528\u3067\u304d\u307e\u305b\u3093\u3002"
  },

  "github-pack-heroku": {
    value: "\u6bce\u670813\u7c73\u30c9\u30eb\u306eHeroku\u30af\u30ec\u30b8\u30c3\u30c8\u309224\u304b\u6708",
    reason: "GitHub Student Developer Pack\u306b\u542b\u307e\u308c\u308bHeroku\u7279\u5178\u3067\u3001\u6bce\u670813\u7c73\u30c9\u30eb\u5206\u306e\u30af\u30ec\u30b8\u30c3\u30c8\u309224\u304b\u6708\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "github-pack-termius": {
    value: "Termius Pro / Team\u6a5f\u80fd\u3092\u5b66\u751f\u671f\u9593\u4e2d\u7121\u6599",
    reason: "GitHub Education\u306e\u8a8d\u8a3c\u6e08\u307f\u5b66\u751f\u306fTermius\u306ePro\u30fbTeam\u6a5f\u80fd\u3092\u7121\u6599\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "github-pack-sentry": {
    value: "Sentry Team\u6a5f\u80fd\u30921\u5e74\u9593\u5229\u7528",
    reason: "GitHub Student Developer Pack\u3092\u901a\u3058\u3066Sentry\u306eTeam\u6a5f\u80fd\u3068\u62e1\u5f35\u3055\u308c\u305f\u76e3\u8996\u67a0\u30921\u5e74\u9593\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "github-pack-bootstrap-studio": {
    value: "\u5b66\u751f\u671f\u9593\u4e2dBootstrap Studio\u3092\u7121\u6599\u5229\u7528",
    reason: "GitHub Student Developer Pack\u306bBootstrap Studio\u306e\u5b66\u751f\u5411\u3051\u7121\u6599\u30e9\u30a4\u30bb\u30f3\u30b9\u304c\u542b\u307e\u308c\u307e\u3059\u3002"
  },

  "github-pack-lambdatest": {
    value: "LambdaTest Live Plan\u30921\u5e74\u9593\u7121\u6599",
    reason: "GitHub Student Developer Pack\u3067LambdaTest\u306eLive Plan\u30921\u5e74\u9593\u7121\u6599\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "github-pack-codedex": {
    value: "Cod\u00e9dex Club\u30926\u304b\u6708\u5229\u7528",
    reason: "GitHub Student Developer Pack\u3067Cod\u00e9dex Club\u30926\u304b\u6708\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "cloudflare-workers-free": {
    value: "\u30b5\u30fc\u30d0\u30fc\u30ec\u30b9\u958b\u767a\u306e\u7121\u6599\u67a0",
    reason: "Cloudflare Workers\u306eFree\u30d7\u30e9\u30f3\u3067\u3001\u5c0f\u898f\u6a21\u306a\u30b5\u30fc\u30d0\u30fc\u30ec\u30b9\u30a2\u30d7\u30ea\u3084API\u3092\u7121\u6599\u67a0\u5185\u3067\u52d5\u304b\u305b\u307e\u3059\u3002",
    caution: "\u30ea\u30af\u30a8\u30b9\u30c8\u6570\u3084CPU\u6642\u9593\u306a\u3069\u306b\u7121\u6599\u67a0\u306e\u4e0a\u9650\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "supabase-free": {
    value: "Postgres\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u30fb\u8a8d\u8a3c\u30fb\u30b9\u30c8\u30ec\u30fc\u30b8\u306e\u7121\u6599\u67a0",
    reason: "Supabase Free\u3067Postgres\u3001API\u3001\u8a8d\u8a3c\u3001\u30b9\u30c8\u30ec\u30fc\u30b8\u306a\u3069\u3092\u5c0f\u898f\u6a21\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u5411\u3051\u306b\u5229\u7528\u3067\u304d\u307e\u3059\u3002",
    caution: "\u4e00\u5b9a\u671f\u9593\u975e\u30a2\u30af\u30c6\u30a3\u30d6\u306a\u7121\u6599\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306f\u4e00\u6642\u505c\u3055\u308c\u308b\u5834\u5408\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "firebase-spark": {
    value: "Firebase\u306e\u8907\u6570\u30b5\u30fc\u30d3\u30b9\u3092\u7121\u6599\u67a0\u3067\u5229\u7528",
    reason: "Firebase Spark\u30d7\u30e9\u30f3\u3067\u3001\u5bfe\u8c61\u306eFirebase\u6a5f\u80fd\u3092\u7121\u6599\u67a0\u306e\u7bc4\u56f2\u5185\u3067\u5229\u7528\u3067\u304d\u307e\u3059\u3002"
  },

  "mongodb-atlas-free": {
    value: "MongoDB Atlas\u306e\u7121\u6599\u30af\u30e9\u30b9\u30bf\u30fc",
    reason: "MongoDB Atlas\u3067\u5c0f\u898f\u6a21\u306a\u958b\u767a\u30fb\u5b66\u7fd2\u7528\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u3092\u7121\u6599\u3067\u4f5c\u6210\u3067\u304d\u307e\u3059\u3002",
    caution: "\u7121\u6599\u30af\u30e9\u30b9\u30bf\u30fc\u81ea\u4f53\u306b\u671f\u9650\u306f\u3042\u308a\u307e\u305b\u3093\u304c\u30011\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3042\u305f\u308a\u306eFree cluster\u6570\u306b\u5236\u9650\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "netlify-free": {
    value: "\u6bce\u6708300\u30af\u30ec\u30b8\u30c3\u30c8\u306e\u7121\u6599\u67a0",
    reason: "Netlify Free\u306f\u9759\u7684\u30b5\u30a4\u30c8\u3084Web\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306e\u30c7\u30d7\u30ed\u30a4\u306b\u4f7f\u3048\u308b\u7121\u6599\u30d7\u30e9\u30f3\u3067\u3059\u3002",
    caution: "\u6708\u9593\u30af\u30ec\u30b8\u30c3\u30c8\u4e0a\u9650\u3092\u8d85\u3048\u308b\u3068\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u304c\u4e00\u6642\u505c\u3059\u308b\u5834\u5408\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "render-free": {
    value: "\u7121\u6599\u306eWeb Service\u30fbStatic Site",
    reason: "Render\u306e\u7121\u6599\u67a0\u3067\u5b66\u7fd2\u30fb\u8a66\u4f5c\u7528\u306eWeb\u30b5\u30fc\u30d3\u30b9\u3084\u9759\u7684\u30b5\u30a4\u30c8\u3092\u516c\u958b\u3067\u304d\u307e\u3059\u3002",
    caution: "\u7121\u6599Web Service\u306f15\u5206\u9593\u30a2\u30af\u30bb\u30b9\u304c\u306a\u3044\u3068\u30b9\u30ea\u30fc\u30d7\u3057\u307e\u3059\u3002\u7121\u6599Postgres\u306b\u306f\u671f\u9650\u304c\u3042\u308a\u307e\u3059\u3002"
  },

  "groq-free-tier": {
    value: "\u30ec\u30fc\u30c8\u5236\u9650\u4ed8\u304dAI API\u306e\u7121\u6599\u67a0",
    reason: "GroqCloud\u306eFree tier\u3067\u3001\u5bfe\u5fdc\u30e2\u30c7\u30eb\u306eAI API\u3092\u30ea\u30af\u30a8\u30b9\u30c8\u30fb\u30c8\u30fc\u30af\u30f3\u5236\u9650\u5185\u3067\u8a66\u305b\u307e\u3059\u3002"
  },

  "neon-free": {
    value: "\u30b5\u30fc\u30d0\u30fc\u30ec\u30b9Postgres\u306e\u7121\u6599\u67a0",
    reason: "Neon Free\u3067Postgres\u3001\u30b3\u30f3\u30d4\u30e5\u30fc\u30c8\u3001\u30b9\u30c8\u30ec\u30fc\u30b8\u3001\u30d6\u30e9\u30f3\u30c1\u6a5f\u80fd\u306a\u3069\u306e\u7121\u6599\u67a0\u3092\u5229\u7528\u3067\u304d\u307e\u3059\u3002",
    caution: "\u7121\u6599\u67a0\u306e\u4e0a\u9650\u306f\u5909\u66f4\u3055\u308c\u308b\u3053\u3068\u304c\u3042\u308b\u305f\u3081\u3001\u5229\u7528\u524d\u306b\u516c\u5f0f\u306e\u6700\u65b0\u30d7\u30e9\u30f3\u5185\u5bb9\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
  }
};


function localizedValue(perk) {
  if (currentLanguage !== "ja") {
    return perk.value_display;
  }

  return JA_DETAIL[perk.id]?.value
    || perk.value_display;
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

  return JA_DETAIL[perk.id]?.reason
    || "\u6761\u4ef6\u306b\u5408\u3046\u7279\u5178\u3067\u3059\u3002\u8a73\u7d30\u306f\u516c\u5f0f\u60c5\u5831\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
}


function localizedCaution(perk) {
  if (currentLanguage !== "ja") {
    return perk.caution || "";
  }

  return JA_DETAIL[perk.id]?.caution
    || "";
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

function newestCheckDate() {
  const values = currentResults
    .map(
      (item) =>
        item.last_checked ||
        item.verified_at
    )
    .filter(Boolean)
    .sort();

  return values.length
    ? values[values.length - 1]
    : null;
}

function renderResults() {
  const container = byId("results");
  const count = byId("result-count");

  if (!container || !count) {
    return;
  }

  if (!currentResults.length) {
    count.textContent = "";

    container.innerHTML =
      `<div class="empty">${escapeHtml(t("noMatches"))}</div>`;

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

  const checked = newestCheckDate();

  const catalogChecked = checked
    ? `
      <div class="catalog-checked">
        ${escapeHtml(t("catalogChecked"))}:
        ${escapeHtml(formatDate(checked))}
      </div>
    `
    : "";

  const aiCard = currentAiTake
    ? `
      <article class="perk ai-take">
        <div class="perk-top">
          <div>
            <h3>${escapeHtml(t("annaTake"))}</h3>

            <div class="provider">
              ${escapeHtml(t("personalized"))}
            </div>
          </div>

          <div class="score">AI</div>
        </div>

        <p
          class="why"
          style="margin-top:16px"
        >
          ${escapeHtml(currentAiTake)}
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

function buildAiPrompt(
  profile,
  results
) {
  const exclusive = results.filter(
    (item) =>
      item.offer_type !== "free_tier" &&
      item.availability !== "check"
  );

  const candidates =
    exclusive.length
      ? exclusive.slice(0, 8)
      : results
          .filter(
            (item) =>
              item.availability
              !== "check"
          )
          .slice(0, 8);

  const compact = candidates.map(
    (item) => ({
      title: item.title,
      provider: item.provider,
      match_score: item.match_score,
      type: item.offer_type,
      value: item.value_display,
      deadline:
        item.deadline_display,
      caution: item.caution,
      verified_reason: item.why,
    })
  );

  const outputLanguage =
    currentLanguage === "ja"
      ? "Japanese"
      : "English";

  return `
User profile:
${JSON.stringify(profile)}

Verified opportunities:
${JSON.stringify(compact)}

Choose the single opportunity this user should look at first.

Rules:
- Use ONLY the verified opportunities above.
- Prefer exclusive benefits over ordinary free tiers when appropriate.
- Do not recommend offers marked as uncertain availability.
- Never invent eligibility, prices, deadlines or benefits.
- Mention the opportunity by name.
- Explain why in 2 short sentences.
- Write the answer in ${outputLanguage}.
- Do not use markdown bullets.
`.trim();
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

      setStaticText();

      if (!button.disabled) {
        status.textContent = t("ready");
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

      status.textContent =
        t("scanning");

      try {
        const response =
          await anna.tools.invoke({
            tool_id: TOOL_ID,
            method: "find_perks",
            args: profile,
          });

        const payload =
          response?.data ?? response;

        currentResults =
          payload?.results ?? [];

        renderResults();

        if (currentResults.length) {
          status.textContent =
            t("comparing");

          try {
            const reply =
              await anna.llm.complete({
                systemPrompt:
                  "You are the recommendation layer of AI Perk Radar. Be concise, factual and cautious. Never invent offers.",

                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: buildAiPrompt(
                        profile,
                        currentResults
                      ),
                    },
                  },
                ],

                maxTokens: 180,
                temperature: 0.2,
              });

            currentAiTake =
              extractLlmText(reply);

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
        });

        status.textContent =
          currentAiTake
            ? t("aiReady")
            : t("updated");

      } catch (error) {
        console.error(error);

        status.textContent =
          `Error: ${error.message}`;

      } finally {
        button.disabled = false;
      }
    }
  );
}

main();
