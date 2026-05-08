import assert from 'node:assert/strict';
import { cancelPreviewedQueryPlan, confirmPreviewedQueryPlan, previewQueryPlan } from './db';

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

async function assertPreviewAuditIncludesBusinessEvidence() {
  const preview = await createPreview();

  assert.equal(preview.audit.isCertified, true);
  assert.ok(preview.audit.assumptions.some((item: string) => item.includes('销售额口径')));
  assert.equal(preview.audit.certification.metrics[0].name, '销售额');
  assert.equal(preview.audit.certification.dimensions[0].name, '国家');
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

function assertCancelWithoutPreviewRecordIsRejected() {
  const result = cancelPreviewedQueryPlan({
    planId: 'plan_missing_record',
  });

  assert.equal(result.canceled, false);
  assert.equal(result.code, 'QUERY_PLAN_NOT_FOUND');
  assert.equal(result.executedSql, false);
  assert.match(result.error, /该预览计划不存在或已丢失/);
}

async function runTest() {
  await assertPreviewAuditIncludesBusinessEvidence();
  await assertConfirmUsesPreviewPlan();
  await assertTamperedPlanIsRejectedBeforeExecution();
  assertCancelWithoutPreviewRecordIsRejected();

  console.log('query plan confirmation tests passed.');
}

runTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
