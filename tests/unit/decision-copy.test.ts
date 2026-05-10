import assert from 'node:assert/strict';
import test from 'node:test';

import { getCompactDecisionQuestion } from '@/lib/decision-copy';

test('keeps short composer decision questions unchanged', () => {
  assert.equal(
    getCompactDecisionQuestion('按哪个口径继续？'),
    '按哪个口径继续？'
  );
});

test('truncates long composer decision questions', () => {
  assert.equal(
    getCompactDecisionQuestion('请选择本次分析使用的业务口径：是按已付款订单金额统计，还是按发货完成订单金额统计？'),
    '请选择本次分析使用的业务口径：是按已付款订单金额统计，还是按...'
  );
});
