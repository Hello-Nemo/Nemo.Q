import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlan } from '@/lib/agent/orchestrator/planner';
import { listCapabilities } from '@/lib/agent/orchestrator/registry';

test('planner keeps simple answers lightweight', () => {
  const plan = createPlan('你好，今天怎么样？', listCapabilities());

  assert.equal(plan.primaryIntent, 'answer');
  assert.equal(plan.complexity, 'simple');
  assert.deepEqual(plan.selectedCapabilityIds, []);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].executionMode, 'self');
});

test('planner routes explicit data-analysis work to nemo-q', () => {
  const plan = createPlan('分析最近一个月各国家的销售额变化', listCapabilities());

  assert.equal(plan.primaryIntent, 'analyze');
  assert.equal(plan.complexity, 'multi_step');
  assert.deepEqual(plan.selectedCapabilityIds, ['nemo-q']);
  assert.equal(plan.needsClarification, false);
  assert.deepEqual(
    plan.steps.map((step) => step.title),
    ['识别分析目标', '委派数据分析', '整理结论']
  );
});

test('planner asks for clarification before ambiguous analysis work', () => {
  const plan = createPlan('帮我看看数据', listCapabilities());

  assert.equal(plan.primaryIntent, 'clarify');
  assert.equal(plan.needsClarification, true);
  assert.deepEqual(plan.selectedCapabilityIds, ['nemo-q']);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].title, '澄清分析目标');
});
