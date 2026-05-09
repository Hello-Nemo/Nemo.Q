const COMPACT_QUESTION_LIMIT = 30;

export function getCompactDecisionQuestion(question: string) {
  const trimmed = question.trim();
  if (trimmed.length <= COMPACT_QUESTION_LIMIT) return trimmed;
  return `${trimmed.slice(0, COMPACT_QUESTION_LIMIT)}...`;
}
