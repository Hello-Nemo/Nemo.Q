import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLatestAgentRunViewModel,
  isLatestAgentRunPart,
} from '@/lib/chat-utils';

test('chat utils rebuild the latest run timeline from streamed trace events', () => {
  const parts = [
    {
      type: 'data-agent-run',
      data: {
        type: 'run_created',
        payload: {
          state: {
            runId: 'run-1',
            userGoal: '分析最近一个月各国家的销售额变化',
            status: 'planned',
            observations: [],
            plan: {
              goal: '分析最近一个月各国家的销售额变化',
              primaryIntent: 'analyze',
              complexity: 'multi_step',
              selectedCapabilityIds: ['nemo-q'],
              needsClarification: false,
              steps: [
                {
                  id: 'step-1',
                  title: '识别分析目标',
                  objective: '提取指标',
                  requiredCapabilityIds: [],
                  executionMode: 'self',
                  expectedOutput: '目标',
                  status: 'pending',
                },
              ],
            },
          },
        },
      },
    },
    {
      type: 'data-agent-run',
      data: {
        type: 'step_started',
        payload: { stepId: 'step-1' },
      },
    },
  ];

  assert.deepEqual(buildLatestAgentRunViewModel(parts), {
    goal: '分析最近一个月各国家的销售额变化',
    status: 'executing',
    selectedCapabilityIds: ['nemo-q'],
    steps: [
      {
        id: 'step-1',
        label: '识别分析目标',
        status: 'loading',
      },
    ],
  });
});

test('chat utils render only the latest run part', () => {
  const parts = [
    { type: 'text', text: 'hello' },
    { type: 'data-agent-run', data: { type: 'plan_created', payload: { plan: {} } } },
    { type: 'data-agent-run', data: { type: 'run_completed', payload: { state: {} } } },
  ];

  assert.equal(isLatestAgentRunPart(parts, 1), false);
  assert.equal(isLatestAgentRunPart(parts, 2), true);
});
