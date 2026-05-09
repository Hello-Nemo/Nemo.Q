import type { ChatSession } from './db';

export type MessagesSnapshot = {
  sessionId: string;
  fingerprint: string;
};

type ShouldPersistMessagesInput = {
  currentSessionId: string | null;
  messageOwnerSessionId: string | null;
  messages: unknown[];
  hydratedSnapshot: MessagesSnapshot | null;
};

export function getMessagesFingerprint(messages: unknown[]) {
  return JSON.stringify(messages);
}

export function shouldPersistMessages({
  currentSessionId,
  messageOwnerSessionId,
  messages,
  hydratedSnapshot,
}: ShouldPersistMessagesInput) {
  if (!currentSessionId || messages.length === 0) return false;
  if (messageOwnerSessionId !== currentSessionId) return false;

  const fingerprint = getMessagesFingerprint(messages);
  if (
    hydratedSnapshot?.sessionId === currentSessionId &&
    hydratedSnapshot.fingerprint === fingerprint
  ) {
    return false;
  }

  return true;
}

export function getCachedSessionMessages<TMessage>(
  sessions: Pick<ChatSession, 'id' | 'messages'>[],
  sessionId: string | null
) {
  if (!sessionId) return [] as TMessage[];
  const session = sessions.find((item) => item.id === sessionId);
  return (session?.messages || []) as TMessage[];
}
