type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export interface SanitizeChatMessagesOptions {
  maxMessages?: number;
  keepRecentToolMessages?: number;
  maxTextChars?: number;
  sampleRows?: number;
}

const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_RECENT_TOOL_MESSAGES = 1;
const DEFAULT_MAX_TEXT_CHARS = 4000;
const DEFAULT_SAMPLE_ROWS = 3;

function truncateText(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}...` : value;
}

function compactAudit(audit: any) {
  if (!audit || typeof audit !== 'object') return audit;

  return {
    ...(audit.planId ? { planId: audit.planId } : {}),
    ...(audit.sql ? { sql: audit.sql } : {}),
    ...(audit.explanation ? { explanation: audit.explanation } : {}),
    ...(Array.isArray(audit.assumptions) ? { assumptions: audit.assumptions } : {}),
    ...(audit.isCertified !== undefined ? { isCertified: audit.isCertified } : {}),
    ...(audit.certificationLevel ? { certificationLevel: audit.certificationLevel } : {}),
    ...(audit.lineage ? { lineage: audit.lineage } : {}),
    ...(audit.plan ? { plan: audit.plan } : {}),
    ...(audit.preview ? { preview: audit.preview } : {}),
    ...(audit.executed ? { executed: audit.executed } : {}),
  };
}

function compactToolOutput(output: any, sampleRows: number) {
  if (!output || typeof output !== 'object') return output;

  return {
    ...(output.error ? { error: output.error } : {}),
    ...(output.code ? { code: output.code } : {}),
    ...(output.message ? { message: output.message } : {}),
    ...(output.rowCount !== undefined ? { rowCount: output.rowCount } : {}),
    ...(Array.isArray(output.rows) && output.rows.length > 0
      ? { sampleRows: output.rows.slice(0, sampleRows) }
      : {}),
    ...(output.sql ? { sql: output.sql } : {}),
    ...(output.planId ? { planId: output.planId } : {}),
    ...(output.planHash ? { planHash: output.planHash } : {}),
    ...(output.previewSqlHash ? { previewSqlHash: output.previewSqlHash } : {}),
    ...(output.requires_action !== undefined ? { requires_action: output.requires_action } : {}),
    ...(output.plan ? { plan: output.plan } : {}),
    ...(output.audit ? { audit: compactAudit(output.audit) } : {}),
  };
}

function compactToolPart(part: any, sampleRows: number) {
  return {
    type: part.type,
    toolCallId: part.toolCallId,
    state: part.state === 'streaming' ? 'done' : part.state,
    input: part.input || part.args || part.invocation?.args,
    output: compactToolOutput(part.output || part.result, sampleRows),
    ...(part.errorText ? { errorText: part.errorText } : {}),
  };
}

function isToolPart(part: any): boolean {
  return typeof part?.type === 'string' && part.type.startsWith('tool-');
}

function cleanParts(parts: any[], keepTools: boolean, options: Required<SanitizeChatMessagesOptions>) {
  return parts
    .map(part => {
      if (part?.type === 'text') {
        return { type: 'text', text: truncateText(part.text || '', options.maxTextChars) };
      }

      if (part?.type === 'reasoning' || part?.type === 'step-start') {
        return null;
      }

      if (isToolPart(part)) {
        return keepTools ? compactToolPart(part, options.sampleRows) : null;
      }

      return null;
    })
    .filter((part): part is NonNullable<typeof part> => Boolean(part));
}

export function sanitizeChatMessagesForAgent(
  messages: any[],
  options: SanitizeChatMessagesOptions = {}
) {
  const resolvedOptions: Required<SanitizeChatMessagesOptions> = {
    maxMessages: options.maxMessages ?? DEFAULT_MAX_MESSAGES,
    keepRecentToolMessages: options.keepRecentToolMessages ?? DEFAULT_RECENT_TOOL_MESSAGES,
    maxTextChars: options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS,
    sampleRows: options.sampleRows ?? DEFAULT_SAMPLE_ROWS,
  };

  const windowedMessages = messages.slice(-resolvedOptions.maxMessages);
  const toolMessageIndexes = windowedMessages
    .map((message, index) => (
      Array.isArray(message.parts) && message.parts.some(isToolPart) ? index : -1
    ))
    .filter(index => index >= 0);
  const keptToolMessageIndexes = new Set(
    toolMessageIndexes.slice(-resolvedOptions.keepRecentToolMessages)
  );

  return windowedMessages
    .map((message, index) => {
      const role = message.role;
      if (role !== 'user' && role !== 'assistant' && role !== 'system') return null;

      const parts = cleanParts(
        Array.isArray(message.parts) ? message.parts : [{ type: 'text', text: message.content || '' }],
        keptToolMessageIndexes.has(index),
        resolvedOptions
      );

      if (parts.length === 0) return null;

      return {
        id: message.id || `m-${index}`,
        role,
        parts,
      };
    })
    .filter((message): message is NonNullable<typeof message> => Boolean(message));
}

export function shouldApplyLoadedSessionMessages(args: {
  currentSessionId: string | null;
  loadedSessionId: string | null;
  lastAppliedSessionId: string | null;
  status: ChatStatus;
}): boolean {
  return (
    args.status === 'ready' &&
    !!args.currentSessionId &&
    args.currentSessionId === args.loadedSessionId &&
    args.lastAppliedSessionId !== args.loadedSessionId
  );
}
