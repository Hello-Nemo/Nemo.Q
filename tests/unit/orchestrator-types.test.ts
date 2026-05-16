import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  AgentPlan,
  AgentRunState,
  AgentTraceEvent,
  CapabilityDefinition,
} from '@/lib/agent/orchestrator/types';
import { RUN_STATUSES } from '@/lib/agent/orchestrator/types';

test('orchestrator contracts describe one coherent run lifecycle', () => {
  const capability: CapabilityDefinition = {
    id: 'nemo-q',
    name: 'Nemo.Q',
    description: 'Semantic data analysis skill',
    domains: ['data-analysis'],
    intents: ['analyze'],
    risk: 'medium',
    cost: 'medium',
  };

  const plan: AgentPlan = {
    goal: '分析最近一个月各国家销售额变化',
    primaryIntent: 'analyze',
    complexity: 'multi_step',
    selectedCapabilityIds: [capability.id],
    needsClarification: false,
    steps: [
      {
        id: 'step-1',
        title: '确认指标与维度',
        objective: '选择销售额和国家维度',
        requiredCapabilityIds: [capability.id],
        executionMode: 'skill',
        expectedOutput: '已确认的查询口径',
        status: 'pending',
      },
    ],
  };

  const state: AgentRunState = {
    runId: 'run-1',
    userGoal: plan.goal,
    plan,
    status: 'planned',
    observations: [],
  };

  const event: AgentTraceEvent = {
    type: 'plan_created',
    payload: { plan },
  };

  assert.equal(state.plan.steps[0].requiredCapabilityIds[0], 'nemo-q');
  assert.equal(event.type, 'plan_created');
  assert.deepEqual(RUN_STATUSES, [
    'received',
    'planned',
    'executing',
    'waiting_user',
    'completed',
    'failed',
  ]);
});
