import assert from 'node:assert/strict';
import { executeQuery } from './db';

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

async function runTest() {
  await assertExecuteQueryGuardFailure('SELECT 1; DROP TABLE users;', 'MULTIPLE_STATEMENTS');
  await assertExecuteQueryGuardFailure('DELETE FROM users', 'NON_READONLY_SQL');
  await assertExecuteQueryGuardFailure('SELECT id FROM payments', 'UNAUTHORIZED_TABLE');

  console.log('executeQuery SQL Guard tests passed.');
}

runTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
