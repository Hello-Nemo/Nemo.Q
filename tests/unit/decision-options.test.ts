import assert from 'node:assert/strict';
import test from 'node:test';

import { getDecisionOptionKey } from '@/lib/decision-options';

test('creates unique keys for duplicated decision option values', () => {
  const options = [
    { label: '按默认理解继续', value: 'continue' },
    { label: '继续执行', value: 'continue' },
  ];

  assert.deepEqual(
    options.map((option, index) => getDecisionOptionKey(option, index)),
    ['continue-0', 'continue-1']
  );
});

test('falls back to label when a streaming option has no value yet', () => {
  const options = [
    { label: '按国家统计' },
    { label: '按国家统计' },
  ];

  assert.deepEqual(
    options.map((option, index) => getDecisionOptionKey(option, index)),
    ['按国家统计-0', '按国家统计-1']
  );
});
