import test from 'node:test';
import assert from 'node:assert/strict';

import { sendChatMessage } from '@/lib/chat-send';

test('sendChatMessage forwards the selected model in request body', async () => {
  let receivedParams: unknown;
  let receivedOptions: unknown;

  const sendMessage = async (params: unknown, options?: unknown) => {
    receivedParams = params;
    receivedOptions = options;
  };

  await sendChatMessage(sendMessage, 'deepseek-v4-pro', { text: 'hello' });

  assert.deepEqual(receivedParams, { text: 'hello' });
  assert.deepEqual(receivedOptions, {
    body: {
      model: 'deepseek-v4-pro',
    },
  });
});
