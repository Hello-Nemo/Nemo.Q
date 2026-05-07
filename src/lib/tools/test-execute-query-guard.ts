import assert from 'node:assert/strict';
import { executeQuery } from './db';
import { detectSemanticCoverage } from '../semantic/coverage';
import { SemanticLayer } from '../semantic/types';
import semanticLayer from '../semantic-layer.json' with { type: 'json' };

const baseArgs = {
  explanation: '验证 executeQuery 会先执行 SQL Guard 并返回结构化审计信息',
  assumptions: ['该测试只覆盖 guard 拦截路径，不连接数据库']
};

async function assertExecuteQueryGuardFailure(sql: string, expectedCode: string) {
  const result = await (executeQuery as any).execute({
    ...baseArgs,
    sql
  });

  assert.equal(result.code, expectedCode);
  assert.equal(result.executedSql, false);
  assert.equal(result.audit.guardStatus, 'failed');
  assert.equal(result.audit.guard.code, expectedCode);
}

async function assertExecuteQuerySemanticCoverageFailure() {
  const result = await (executeQuery as any).execute({
    question: '各国家销售额是多少？',
    explanation: '按国家统计销售额，属于标准指标查询，应走语义层',
    assumptions: ['销售额口径应使用语义层中的 sales_amount 认证指标'],
    sql: `
      SELECT users.country, SUM(orders.total_price) AS sales_amount
      FROM users
      JOIN orders ON users.id = orders.user_id
      GROUP BY users.country
    `
  });

  assert.equal(result.code, 'SEMANTIC_COVERAGE_REQUIRED');
  assert.equal(result.executedSql, false);
  assert.match(result.error, /该查询应使用 semanticQuery/);
  assert.match(result.hint, /listSemanticAtoms/);
  assert.match(result.hint, /semanticQuery/);
  assert.deepEqual(result.recoveryActions, ['listSemanticAtoms', 'semanticQuery']);
  assert.equal(result.details.matchedMetrics[0].id, 'sales_amount');
  assert.equal(result.audit.semanticCoverage.coverageStatus, 'failed');
}

function assertSemanticCoverageAllowsDetailQuery() {
  const result = detectSemanticCoverage({
    sql: `
      SELECT users.id, users.username, users.country
      FROM users
      WHERE users.country IN ('China', '中国')
      LIMIT 100
    `,
    question: '列出所有来自中国的用户',
    semanticLayer: semanticLayer as SemanticLayer
  });

  assert.equal(result.coverageStatus, 'passed');
  assert.equal(result.executedSql, true);
  assert.equal(result.details.matchedMetrics.length, 0);
}

async function runTest() {
  await assertExecuteQueryGuardFailure('SELECT 1; DROP TABLE users;', 'MULTIPLE_STATEMENTS');
  await assertExecuteQueryGuardFailure('DELETE FROM users', 'NON_READONLY_SQL');
  await assertExecuteQueryGuardFailure('SELECT id FROM payments', 'UNAUTHORIZED_TABLE');
  await assertExecuteQuerySemanticCoverageFailure();
  assertSemanticCoverageAllowsDetailQuery();

  console.log('executeQuery SQL Guard tests passed.');
}

runTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
