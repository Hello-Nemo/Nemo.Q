import assert from 'node:assert/strict';
import {
  getPreviewToolPartInput,
  getPreviewToolPartOutput,
  hydratePreviewToolPart,
  needsPreviewHydration,
} from './query-plan-ui';

const plan = {
  intent: 'metric_query',
  metrics: [{ id: 'sales_amount' }],
  dimensions: [{ id: 'user_country' }],
  filters: [],
};

function assertMissingPreviewOutputCanBeHydrated() {
  const part = {
    type: 'tool-previewQueryPlan',
    toolCallId: 'call-preview-1',
    state: 'input-available',
    input: {
      explanation: '按国家统计销售额贡献排名',
      plan,
    },
  };

  assert.equal(needsPreviewHydration(part), true);
  assert.deepEqual(getPreviewToolPartInput(part), part.input);
  assert.equal(getPreviewToolPartOutput(part), undefined);

  const hydrated = hydratePreviewToolPart(part, {
    sql: 'SELECT users.country AS user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1',
    planId: 'plan_manual_1',
    planHash: 'plan-hash',
    previewSqlHash: 'sql-hash',
    plan,
    explanation: part.input.explanation,
    requires_action: true,
  });

  assert.equal(hydrated.state, 'output-available');
  assert.equal(hydrated.input, part.input);
  assert.equal(hydrated.output.sql.startsWith('SELECT users.country'), true);
  assert.equal(hydrated.output.planId, 'plan_manual_1');
  assert.equal(needsPreviewHydration(hydrated), false);
}

assertMissingPreviewOutputCanBeHydrated();
console.log('query plan UI hydration tests passed.');
