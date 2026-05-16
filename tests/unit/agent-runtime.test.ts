import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceStep,
  completeRun,
  startRun,
} from '@/lib/agent/orchestrator/runtime';

test('runtime progresses an analyzable request through execution to completion', () => {
  const run = startRun('分析最近一个月各国家的销售额变化', 'run-1');

  assert.equal(run.state.status, 'planned');
  assert.deepEqual(run.events.map((event) => event.type), [
    'run_created',
    'plan_created',
    'capability_selected',
  ]);

  const executing = advanceStep(run, 'delegate-analysis');
  assert.equal(executing.state.status, 'executing');
  assert.equal(executing.state.currentStepId, 'delegate-analysis');
  assert.equal(executing.state.plan.steps[1].status, 'running');

  const completed = completeRun(executing);
  assert.equal(completed.state.status, 'completed');
  assert.equal(completed.events.at(-1)?.type, 'run_completed');
});

test('runtime pauses ambiguous work while waiting for the user', () => {
  const run = startRun('帮我看看数据', 'run-2');

  assert.equal(run.state.status, 'waiting_user');
  assert.equal(run.state.plan.needsClarification, true);
  assert.deepEqual(run.events.map((event) => event.type), [
    'run_created',
    'plan_created',
    'capability_selected',
  ]);
});
