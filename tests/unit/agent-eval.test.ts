import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlan } from '@/lib/agent/orchestrator/planner';
import { listCapabilities } from '@/lib/agent/orchestrator/registry';
import { scoreAgentPlan } from '@/lib/agent/orchestrator/eval';

test('agent eval scores a matching plan as passing', () => {
  const plan = createPlan('分析最近一个月各国家的销售额变化', listCapabilities());

  const result = scoreAgentPlan(
    {
      id: 'analysis',
      request: '分析最近一个月各国家的销售额变化',
      expectedIntent: 'analyze',
      expectedCapabilityIds: ['nemo-q'],
      needsClarification: false,
      minSteps: 3,
      maxSteps: 3,
    },
    plan
  );

  assert.deepEqual(result, {
    passed: true,
    failures: [],
  });
});

test('agent eval reports mismatched capability selection', () => {
  const plan = createPlan('你好，今天怎么样？', listCapabilities());

  const result = scoreAgentPlan(
    {
      id: 'wrong-capability',
      request: '你好，今天怎么样？',
      expectedIntent: 'answer',
      expectedCapabilityIds: ['nemo-q'],
      needsClarification: false,
      minSteps: 1,
      maxSteps: 1,
    },
    plan
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, ['expected capabilities nemo-q, received none']);
});
