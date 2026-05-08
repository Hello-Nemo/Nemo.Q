import { describe, expect, it } from 'vitest';
import {
  sanitizeChatMessagesForAgent,
  shouldApplyLoadedSessionMessages,
} from './chat-message-sanitizer';

describe('chat message sanitizer', () => {
  it('removes reasoning and bulky old tool outputs before sending history to the agent', () => {
    const messages = [
      {
        id: 'u-1',
        role: 'user',
        parts: [{ type: 'text', text: '各国家销售额是多少？' }],
      },
      {
        id: 'a-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', reasoning: 'very long hidden reasoning' },
          {
            type: 'tool-semanticQuery',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: { plan: { metrics: [{ id: 'sales_amount' }] } },
            output: {
              rows: Array.from({ length: 50 }, (_, idx) => ({ idx })),
              audit: { sql: 'SELECT * FROM orders', explanation: 'old audit' },
            },
          },
          { type: 'text', text: '完成。' },
        ],
      },
      {
        id: 'u-2',
        role: 'user',
        parts: [{ type: 'text', text: '对比今年和去年各月的销售额' }],
      },
    ];

    const sanitized = sanitizeChatMessagesForAgent(messages as any, {
      maxMessages: 8,
      keepRecentToolMessages: 0,
    });

    expect(JSON.stringify(sanitized)).not.toContain('very long hidden reasoning');
    expect(JSON.stringify(sanitized)).not.toContain('"rows"');
    expect(sanitized.at(-1)?.parts).toEqual([{ type: 'text', text: '对比今年和去年各月的销售额' }]);
  });

  it('keeps only the latest bounded conversation window', () => {
    const messages = Array.from({ length: 12 }, (_, idx) => ({
      id: `m-${idx}`,
      role: idx % 2 === 0 ? 'user' : 'assistant',
      parts: [{ type: 'text', text: `message ${idx}` }],
    }));

    const sanitized = sanitizeChatMessagesForAgent(messages as any, { maxMessages: 5 });

    expect(sanitized).toHaveLength(5);
    expect(sanitized[0].id).toBe('m-7');
    expect(sanitized[4].id).toBe('m-11');
  });

  it('applies loaded messages only when they belong to the active ready session', () => {
    expect(shouldApplyLoadedSessionMessages({
      currentSessionId: 'session-a',
      loadedSessionId: 'session-a',
      lastAppliedSessionId: 'session-b',
      status: 'ready',
    })).toBe(true);

    expect(shouldApplyLoadedSessionMessages({
      currentSessionId: 'session-a',
      loadedSessionId: 'session-b',
      lastAppliedSessionId: 'session-b',
      status: 'ready',
    })).toBe(false);

    expect(shouldApplyLoadedSessionMessages({
      currentSessionId: 'session-a',
      loadedSessionId: 'session-a',
      lastAppliedSessionId: 'session-b',
      status: 'streaming',
    })).toBe(false);
  });
});
