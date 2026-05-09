import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getActiveDecisionTarget,
  getDecisionResolution,
  isDecisionPartReady,
  hasPendingDecision,
  shouldBlockComposerSubmit,
} from './decision-state';

const assistantMessage = (parts: any[]) => ({
  id: `assistant-${parts[0]?.type || 'part'}`,
  role: 'assistant',
  parts,
});

const userMessage = (text: string) => ({
  id: `user-${text}`,
  role: 'user',
  parts: [{ type: 'text', text }],
});

test('marks a clarification turn resolved when the user replies after it', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-askClarification',
        toolCallId: 'clarification-1',
        input: { question: '按哪个口径继续？' },
      },
    ]),
    userMessage('选择：按国家统计'),
  ];

  assert.deepEqual(getDecisionResolution(messages, 0), {
    status: 'resolved',
    selectedAnswer: '选择：按国家统计',
  });
  assert.equal(hasPendingDecision(messages), false);
});

test('keeps the latest clarification pending before the user answers', () => {
  const messages = [
    userMessage('分析销售额'),
    assistantMessage([
      {
        type: 'tool-askClarification',
        toolCallId: 'clarification-2',
        input: { question: '请选择时间范围' },
      },
    ]),
  ];

  assert.deepEqual(getDecisionResolution(messages, 1), {
    status: 'pending',
    selectedAnswer: undefined,
  });
  assert.equal(hasPendingDecision(messages), true);
  assert.deepEqual(getActiveDecisionTarget(messages), {
    messageIndex: 1,
    partIndex: 0,
  });
});

test('does not expose a decision while tool input is still streaming', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-askClarification',
        toolCallId: 'clarification-streaming',
        state: 'input-streaming',
        input: { question: '请选择时间范围' },
      },
    ]),
  ];

  assert.equal(isDecisionPartReady(messages[0].parts[0]), false);
  assert.equal(hasPendingDecision(messages), false);
  assert.equal(getActiveDecisionTarget(messages), null);
});

test('exposes a decision once tool input is available', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-askClarification',
        toolCallId: 'clarification-ready',
        state: 'input-available',
        input: { question: '请选择时间范围' },
      },
    ]),
  ];

  assert.equal(isDecisionPartReady(messages[0].parts[0]), true);
  assert.equal(hasPendingDecision(messages), true);
  assert.deepEqual(getActiveDecisionTarget(messages), {
    messageIndex: 0,
    partIndex: 0,
  });
});

test('waits for query preview output before exposing the execution decision', () => {
  const inputAvailable = {
    type: 'tool-previewQueryPlan',
    toolCallId: 'preview-input',
    state: 'input-available',
    input: {
      explanation: '预览查询计划',
      plan: { intent: 'draft' },
    },
  };
  const outputAvailable = {
    ...inputAvailable,
    toolCallId: 'preview-output',
    state: 'output-available',
    output: {
      requires_action: true,
      explanation: '预览查询计划',
      sql: 'select 1',
      plan: { intent: 'draft' },
    },
  };

  assert.equal(isDecisionPartReady(inputAvailable), false);
  assert.equal(isDecisionPartReady(outputAvailable), true);
  assert.equal(getActiveDecisionTarget([assistantMessage([inputAvailable])]), null);
  assert.deepEqual(getActiveDecisionTarget([assistantMessage([outputAvailable])]), {
    messageIndex: 0,
    partIndex: 0,
  });
});

test('treats a preview confirmation as resolved after a follow-up user reply', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-previewQueryPlan',
        toolCallId: 'preview-1',
        output: { requires_action: true, explanation: '预览查询计划' },
      },
    ]),
    userMessage('我不确定，请重新调整'),
  ];

  assert.deepEqual(getDecisionResolution(messages, 0), {
    status: 'resolved',
    selectedAnswer: '我不确定，请重新调整',
  });
});

test('treats a confirmed preview output as resolved without another user reply', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-previewQueryPlan',
        toolCallId: 'preview-2',
        output: {
          requires_action: false,
          selectedAnswer: '确认并执行',
        },
      },
    ]),
  ];

  assert.deepEqual(getDecisionResolution(messages, 0), {
    status: 'resolved',
    selectedAnswer: '确认并执行',
  });
  assert.equal(hasPendingDecision(messages), false);
  assert.equal(getActiveDecisionTarget(messages), null);
});

test('returns the latest pending decision target when older decisions are resolved', () => {
  const messages = [
    assistantMessage([
      {
        type: 'tool-askClarification',
        toolCallId: 'clarification-old',
        input: { question: '旧问题' },
      },
    ]),
    userMessage('选择：旧答案'),
    assistantMessage([
      {
        type: 'tool-previewQueryPlan',
        toolCallId: 'preview-latest',
        output: { requires_action: true, explanation: '新预览' },
      },
    ]),
  ];

  assert.deepEqual(getActiveDecisionTarget(messages), {
    messageIndex: 2,
    partIndex: 0,
  });
});

test('does not block free text composer submission just because a decision is pending', () => {
  assert.equal(
    shouldBlockComposerSubmit({
      isStreaming: false,
      isDecisionPending: true,
      text: '补充说明口径',
    }),
    false
  );
  assert.equal(
    shouldBlockComposerSubmit({
      isStreaming: true,
      isDecisionPending: true,
      text: '补充说明口径',
    }),
    true
  );
});
