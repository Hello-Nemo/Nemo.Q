type MessageLike = {
  role?: string;
  parts?: Array<Record<string, any>>;
};

type DecisionStatus = 'pending' | 'resolved';

export type DecisionResolution = {
  status: DecisionStatus;
  selectedAnswer?: string;
};

export type ActiveDecisionTarget = {
  messageIndex: number;
  partIndex: number;
};

const DECISION_PART_TYPES = new Set([
  'tool-askClarification',
  'tool-previewQueryPlan',
]);

const EXECUTION_PART_TYPES = new Set([
  'tool-semanticQuery',
  'tool-executeQuery',
  'tool-render_chart',
  'tool-generateInsightCanvas',
]);

const getPartOutput = (part: Record<string, any>) => part?.output || part?.result;
const getPartInput = (part: Record<string, any>) => part?.input || part?.args || part?.invocation?.args;

const getTextFromMessage = (message: MessageLike) => {
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
};

const hasExecutionAfter = (parts: Array<Record<string, any>>, index: number) => (
  parts.slice(index + 1).some((part) => EXECUTION_PART_TYPES.has(part?.type))
);

export function getDecisionPartIndex(message?: MessageLike | null) {
  if (!message || !Array.isArray(message.parts)) return -1;

  return message.parts.findIndex((part) => isDecisionPartReady(part));
}

export function isDecisionPartReady(part?: Record<string, any> | null) {
  if (!part || !DECISION_PART_TYPES.has(part.type)) return false;

  if (part.state === 'input-streaming' || part.state === 'output-error') {
    return false;
  }

  const output = getPartOutput(part);
  const input = getPartInput(part);

  if (part.type === 'tool-previewQueryPlan') {
    if (part.state === 'output-available') return true;
    if (part.state === 'input-available') return false;
    if (typeof part.state === 'string') return false;
    return !!(output || input);
  }

  if (part.state === 'input-available' || part.state === 'output-available') {
    return true;
  }

  if (typeof part.state === 'string') {
    return false;
  }

  return !!(output || input);
}

export function getDecisionResolution(
  messages: MessageLike[],
  messageIndex: number
): DecisionResolution {
  const message = messages[messageIndex];
  const decisionIndex = getDecisionPartIndex(message);

  if (decisionIndex === -1) {
    return { status: 'resolved', selectedAnswer: undefined };
  }

  const decisionPart = message.parts?.[decisionIndex];
  const output = decisionPart ? getPartOutput(decisionPart) : undefined;
  if (output?.requires_action === false) {
    return {
      status: 'resolved',
      selectedAnswer: output.selectedAnswer,
    };
  }

  if (
    decisionPart?.type === 'tool-previewQueryPlan' &&
    hasExecutionAfter(message.parts || [], decisionIndex)
  ) {
    return {
      status: 'resolved',
      selectedAnswer: '已执行',
    };
  }

  const nextUserReply = messages
    .slice(messageIndex + 1)
    .find((candidate) => candidate.role === 'user' && getTextFromMessage(candidate));
  const selectedAnswer = nextUserReply ? getTextFromMessage(nextUserReply) : undefined;

  return selectedAnswer
    ? { status: 'resolved', selectedAnswer }
    : { status: 'pending', selectedAnswer: undefined };
}

export function hasPendingDecision(messages: MessageLike[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (getDecisionPartIndex(messages[index]) === -1) continue;
    return getDecisionResolution(messages, index).status === 'pending';
  }

  return false;
}

export function getActiveDecisionTarget(messages: MessageLike[]): ActiveDecisionTarget | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const partIndex = getDecisionPartIndex(messages[messageIndex]);
    if (partIndex === -1) continue;
    if (getDecisionResolution(messages, messageIndex).status !== 'pending') continue;

    return { messageIndex, partIndex };
  }

  return null;
}

export function shouldBlockComposerSubmit({
  isStreaming,
  text,
}: {
  isStreaming: boolean;
  isDecisionPending: boolean;
  text: string;
}) {
  return isStreaming || text.trim().length === 0;
}
