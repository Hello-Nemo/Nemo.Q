import assert from 'node:assert/strict';
import { confirmPreviewedQueryPlan, previewQueryPlan } from './db';

const basePlan = {
  intent: 'metric_query' as const,
  metrics: [{ id: 'sales_amount' }],
  dimensions: [{ id: 'user_country' }],
  filters: [],
};

async function createPreview() {
  return await (previewQueryPlan as any).execute({
    explanation: '按国家预览销售额，等待用户确认后再执行',
    plan: basePlan,
  });
}

async function assertConfirmUsesPreviewPlan() {
  const preview = await createPreview();

  assert.ok(preview.planId, 'previewQueryPlan should return a planId');
  assert.ok(preview.planHash, 'previewQueryPlan should return a plan hash');
  assert.ok(preview.previewSqlHash, 'previewQueryPlan should return a preview SQL hash');
  assert.equal(preview.requires_action, true);

  const executedSql: string[] = [];
  const result = await confirmPreviewedQueryPlan({
    planId: preview.planId,
    plan: preview.plan,
    previewPlanHash: preview.planHash,
    previewSqlHash: preview.previewSqlHash,
    executeSql: async (sql) => {
      executedSql.push(sql);
      return { rows: [{ user_country: 'China', sales_amount: '100.00' }], rowCount: 1 };
    },
  });

  assert.equal(executedSql.length, 1);
  assert.equal(executedSql[0], preview.sql);
  assert.equal(result.audit.planId, preview.planId);
  assert.equal(result.audit.preview.planHash, preview.planHash);
  assert.equal(result.audit.preview.sqlHash, preview.previewSqlHash);
  assert.equal(result.audit.executed.planHash, preview.planHash);
  assert.equal(result.audit.executed.sqlHash, preview.previewSqlHash);
  assert.deepEqual(
    result.audit.approvalChain.map((event: any) => event.stage),
    ['preview', 'confirm', 'execute']
  );
}

async function assertTamperedPlanIsRejectedBeforeExecution() {
  const preview = await createPreview();
  let executeCalled = false;

  const result = await confirmPreviewedQueryPlan({
    planId: preview.planId,
    plan: {
      ...preview.plan,
      metrics: [{ id: 'order_count' }],
    },
    previewPlanHash: preview.planHash,
    previewSqlHash: preview.previewSqlHash,
    executeSql: async () => {
      executeCalled = true;
      return { rows: [], rowCount: 0 };
    },
  });

  assert.equal(executeCalled, false);
  assert.equal(result.code, 'PREVIEW_EXECUTION_MISMATCH');
  assert.equal(result.executedSql, false);
  assert.match(result.error, /预览计划与确认计划不一致/);
}

async function runTest() {
  await assertConfirmUsesPreviewPlan();
  await assertTamperedPlanIsRejectedBeforeExecution();

  console.log('query plan confirmation tests passed.');
}

runTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
