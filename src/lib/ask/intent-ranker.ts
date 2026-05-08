import type { IntentCandidate } from './intent-candidates';

export const DEFAULT_INTENT_CONFIDENCE_THRESHOLD = 0.72;

export function canDefaultExecuteIntentCandidate(candidate: IntentCandidate) {
  return (
    candidate.confidence >= DEFAULT_INTENT_CONFIDENCE_THRESHOLD &&
    candidate.coverage.missingConcepts.length === 0 &&
    candidate.assumptions.length > 0
  );
}

export function rankIntentCandidates(candidates: IntentCandidate[]) {
  return [...candidates]
    .map(candidate => ({
      ...candidate,
      canDefaultExecute: canDefaultExecuteIntentCandidate(candidate),
    }))
    .sort((a, b) => (
      b.confidence - a.confidence ||
      b.coverage.score - a.coverage.score ||
      a.id.localeCompare(b.id)
    ));
}

export function selectDefaultIntentCandidate(candidates: IntentCandidate[]) {
  const [topCandidate] = rankIntentCandidates(candidates);
  if (!topCandidate || !canDefaultExecuteIntentCandidate(topCandidate)) {
    return null;
  }

  return topCandidate;
}
