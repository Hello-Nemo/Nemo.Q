export type CandidateConfidenceInput = {
  coverageScore: number;
  conceptStrength: number;
  certifiedConcepts: boolean;
  ambiguousConceptCount: number;
  missingConceptCount: number;
  hasExplicitAssumptions: boolean;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value) * 100) / 100;
}

export function computeCandidateConfidence(input: CandidateConfidenceInput) {
  const certifiedBonus = input.certifiedConcepts ? 0.08 : 0;
  const assumptionBonus = input.hasExplicitAssumptions ? 0.07 : 0;
  const ambiguityPenalty = Math.min(0.12, input.ambiguousConceptCount * 0.03);
  const missingPenalty = Math.min(0.5, input.missingConceptCount * 0.35);

  const rawScore =
    input.coverageScore * 0.52 +
    input.conceptStrength * 0.28 +
    certifiedBonus +
    assumptionBonus -
    ambiguityPenalty -
    missingPenalty;

  if (input.missingConceptCount > 0) {
    return Math.min(0.68, roundScore(rawScore));
  }

  return roundScore(rawScore);
}
