export function buildRecommendationPrompt(
  profile,
  recommendation,
  outputLanguage
) {
  const selected = {
    title: recommendation.title,
    provider: recommendation.provider,
    match_score: recommendation.match_score,
    type: recommendation.offer_type,
    value: recommendation.value_display,
    deadline: recommendation.deadline_display,
    caution: recommendation.caution,
    verified_reason: recommendation.why,
  };

  return `
User profile:
${JSON.stringify(profile)}

Opportunity already selected by the matching engine:
${JSON.stringify(selected)}

Explain why this selected opportunity fits the user.

Rules:
- Do not choose, rank, or compare opportunities.
- Discuss only the selected opportunity above.
- Mention the selected opportunity by its exact title.
- Use only the verified facts above.
- Never invent eligibility, prices, deadlines, or benefits.
- Explain the fit in 2 short sentences.
- Write the answer in ${outputLanguage}.
- Do not use markdown bullets.
`.trim();
}
