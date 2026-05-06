import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildSqlGuardPolicy, guardSql } from './guard';
import { SemanticLayer } from '../semantic/types';

const semanticLayer: SemanticLayer = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
);

const policy = buildSqlGuardPolicy(semanticLayer);

function assertGuardFails(sql: string, expectedCode: string) {
  const result = guardSql(sql, policy);

  assert.equal(result.guardStatus, 'failed', `${sql} should be rejected`);
  assert.equal(result.code, expectedCode);
  assert.equal(result.executedSql, false);
  assert.ok(result.message.length > 0);
}

function assertGuardPasses(sql: string) {
  const result = guardSql(sql, policy);

  assert.equal(result.guardStatus, 'passed', `${sql} should pass`);
  assert.equal(result.executedSql, true);
  assert.ok(result.sql.length > 0);
  assert.ok(result.audit.guardStatus === 'passed');
  return result;
}

assertGuardFails('SELECT 1; DROP TABLE users;', 'MULTIPLE_STATEMENTS');
assertGuardFails('DELETE FROM users', 'NON_READONLY_SQL');
assertGuardFails('INSERT INTO users (username) VALUES (\'mallory\')', 'NON_READONLY_SQL');
assertGuardFails('UPDATE users SET username = \'mallory\'', 'NON_READONLY_SQL');
assertGuardFails('DROP TABLE users', 'NON_READONLY_SQL');
assertGuardFails('ALTER TABLE users ADD COLUMN password text', 'NON_READONLY_SQL');
assertGuardFails('TRUNCATE TABLE users', 'NON_READONLY_SQL');
assertGuardFails('CREATE TABLE audit_log (id int)', 'NON_READONLY_SQL');

assertGuardFails('SELECT id FROM payments', 'UNAUTHORIZED_TABLE');
assertGuardFails('SELECT password_hash FROM users', 'UNAUTHORIZED_FIELD');
assertGuardFails('SELECT * FROM users', 'WILDCARD_NOT_ALLOWED');
assertGuardFails("SELECT pg_read_file('/etc/passwd')", 'DANGEROUS_FUNCTION');

const selectResult = assertGuardPasses('SELECT users.id, users.username FROM users LIMIT 5');
assert.equal(selectResult.sql, 'SELECT users.id, users.username FROM users LIMIT 5');
assert.deepEqual(selectResult.audit.tables, ['users']);
assert.deepEqual(selectResult.audit.fields.sort(), ['users.id', 'users.username']);

const withResult = assertGuardPasses(`
  WITH user_orders AS (
    SELECT orders.user_id, SUM(orders.total_price) AS total_sales
    FROM orders
    GROUP BY orders.user_id
  )
  SELECT users.username, user_orders.total_sales
  FROM user_orders
  JOIN users ON users.id = user_orders.user_id
  LIMIT 10
`);
assert.match(withResult.sql, /^WITH/i);
assert.ok(withResult.audit.tables.includes('orders'));
assert.ok(withResult.audit.tables.includes('users'));
assert.ok(withResult.audit.fields.includes('orders.total_price'));
assert.ok(withResult.audit.fields.includes('users.username'));

const limitedResult = assertGuardPasses('SELECT users.username FROM users');
assert.equal(limitedResult.sql, 'SELECT users.username FROM users LIMIT 1000');
assert.equal(limitedResult.audit.limitApplied, true);

const aggregateResult = assertGuardPasses('SELECT COUNT(users.id) AS user_count FROM users');
assert.equal(aggregateResult.sql, 'SELECT COUNT(users.id) AS user_count FROM users');
assert.equal(aggregateResult.audit.limitApplied, false);

console.log('SQL Guard tests passed.');
