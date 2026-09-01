import type { BriefResult } from '@/lib/types';

const investmentRecommendationPatterns = [
  /\b(?:should|must|need to|ought to)\s+(?:not\s+)?(?:invest|buy|sell|fund|back)\b/i,
  /\b(?:should|must|need to|ought to)\s+pass(?:\s+on\b|[.!?]?$)/i,
  /\b(?:do not|never|avoid)\s+(?:invest|buy|fund|back)\b/i,
  /(?:^|[.!?]\s+)(?:please\s+)?(?:do not\s+)?(?:invest|buy|sell|fund|back)\b/i,
  /(?:^|[.!?]\s+)(?:please\s+)?pass(?:\s+on\b|[.!?]?$)/i,
  /\b(?:we\s+)?recommend(?:s|ed|ing)?(?:\s+[a-z]+){0,4}\s+(?:invest|investment|investing|fund|funding|buy|buying|sell|selling|pass|passing)\b/i,
  /\b(?:recommend|advise)\s+(?:an?\s+)?(?:investment|purchase|sale|pass)\b/i,
  /\b(?:investment|company)\s+(?:recommendation|rating|score)\b/i,
  /\b(?:strong|weak|attractive|poor|good|bad)\s+investment\b/i,
  /\b(?:company|investment)\s+is\s+(?:an?\s+)?(?:buy|sell|pass)\b/i,
];

export function hasInvestmentRecommendation(text: string) {
  const normalized = text.trim();
  return investmentRecommendationPatterns.some((pattern) => pattern.test(normalized));
}

export function validateBriefSafety(brief: BriefResult) {
  const items = [
    brief.currentState,
    brief.changes,
    brief.risks,
    brief.openQuestions,
    brief.suggestedQuestions,
  ].flat();
  if (items.some((item) => hasInvestmentRecommendation(item.text))) {
    throw new Error('The brief contains an investment recommendation.');
  }
}
