import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecommendationPrompt,
} from "../bundle/recommendation.mjs";


test("the LLM explains only the engine-selected perk", () => {
  const prompt = buildRecommendationPrompt(
    {
      country: "JP",
      student: true,
      interests: ["ai", "coding"],
    },
    {
      title: "AWS Student Rewards",
      provider: "AWS",
      match_score: 99,
      offer_type: "student_perk",
      value_display: "Up to $579",
      deadline_display: "No fixed date",
      caution: "",
      why: "Strong student and developer fit.",
    },
    "English"
  );

  assert.match(
    prompt,
    /Opportunity already selected by the matching engine/
  );
  assert.match(
    prompt,
    /Do not choose, rank, or compare opportunities/
  );
  assert.match(prompt, /AWS Student Rewards/);
  assert.doesNotMatch(prompt, /Google AI Plus/);
  assert.doesNotMatch(
    prompt,
    /Choose the single opportunity/
  );
});
