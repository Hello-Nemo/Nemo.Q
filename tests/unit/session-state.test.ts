import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCachedSessionMessages,
  getMessagesFingerprint,
  shouldPersistMessages,
} from '@/lib/session-state';

const userMessage = (id: string, text: string) => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
});

test('does not persist messages that were just hydrated from a historical session', () => {
  const messages = [userMessage('msg-old-1', '历史问题')];
  const fingerprint = getMessagesFingerprint(messages);

  assert.equal(
    shouldPersistMessages({
      currentSessionId: 'old-session',
      messageOwnerSessionId: 'old-session',
      messages,
      hydratedSnapshot: {
        sessionId: 'old-session',
        fingerprint,
      },
    }),
    false
  );
});

test('does not persist stale messages while switching between sessions', () => {
  const messages = [userMessage('msg-current-1', '当前会话的问题')];

  assert.equal(
    shouldPersistMessages({
      currentSessionId: 'old-session',
      messageOwnerSessionId: 'current-session',
      messages,
      hydratedSnapshot: null,
    }),
    false
  );
});

test('persists a selected historical session after a follow-up changes its messages', () => {
  const hydratedMessages = [userMessage('msg-old-1', '历史问题')];
  const updatedMessages = [
    ...hydratedMessages,
    userMessage('msg-old-2', '继续追问'),
  ];

  assert.equal(
    shouldPersistMessages({
      currentSessionId: 'old-session',
      messageOwnerSessionId: 'old-session',
      messages: updatedMessages,
      hydratedSnapshot: {
        sessionId: 'old-session',
        fingerprint: getMessagesFingerprint(hydratedMessages),
      },
    }),
    true
  );
});

test('returns empty messages immediately for a newly created unsaved session', () => {
  assert.deepEqual(
    getCachedSessionMessages(
      [
        {
          id: 'existing-session',
          messages: [userMessage('msg-existing-1', '已有会话')],
        },
      ],
      'new-session'
    ),
    []
  );
});
