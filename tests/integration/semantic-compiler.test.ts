import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SQLCompiler, dbTools } from '../../skills/nemo-q';
import type { QueryPlan, SemanticLayer } from '../../skills/nemo-q';

const semanticLayer: SemanticLayer = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'skills/nemo-q/lib/semantic-layer.json'), 'utf8')
);

const compiler = new SQLCompiler(semanticLayer);

function assertCompiles(name: string, plan: QueryPlan, expectedFragments: string[]) {
  const result = compiler.compile(plan);

  for (const fragment of expectedFragments) {
    assert.match(
      result.sql,
      new RegExp(fragment),
      `${name} should include SQL fragment: ${fragment}`
    );
  }

  return result;
}

function assertCompileFails(name: string, plan: QueryPlan, expectedMessage: string) {
  assert.throws(
    () => compiler.compile(plan),
    (error) => error instanceof Error && error.message === expectedMessage,
    `${name} should fail with: ${expectedMessage}`
  );
}

function assertSqlContainsTimes(name: string, sql: string, fragment: string, expectedCount: number) {
  const count = [...sql.matchAll(new RegExp(fragment, 'g'))].length;
  assert.equal(
    count,
    expectedCount,
    `${name} should include SQL fragment ${expectedCount} times: ${fragment}`
  );
}

async function runTest() {
  assertCompiles(
    'Basic Metric Query',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'user_country' }],
      filters: [],
      limit: 10
    },
    ['SUM\\(orders\\.total_price\\) AS sales_amount', 'users\\.country AS user_country']
  );

  assertCompiles(
    'Semantic Filter Query',
    {
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [{ id: 'product_category' }],
      timeRange: { type: 'preset', value: 'last_month' },
      filters: [{ field: 'product_category', operator: '=', value: 'Electronics' }],
      orderBy: [{ field: 'order_count', direction: 'desc' }]
    },
    [`products\\.category = 'Electronics'`, 'ORDER BY order_count desc']
  );

  assertCompiles(
    'Preset timeRange: today',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'today' },
      filters: []
    },
    [
      "orders\\.order_date >= CURRENT_DATE",
      "orders\\.order_date < CURRENT_DATE \\+ INTERVAL '1 day'"
    ]
  );

  assertCompiles(
    'Preset timeRange: yesterday',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'yesterday' },
      filters: []
    },
    [
      "orders\\.order_date >= CURRENT_DATE - INTERVAL '1 day'",
      'orders\\.order_date < CURRENT_DATE'
    ]
  );

  assertCompiles(
    'Preset timeRange: last_7_days',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_7_days' },
      filters: []
    },
    [
      "orders\\.order_date >= CURRENT_DATE - INTERVAL '7 days'",
      "orders\\.order_date < CURRENT_DATE \\+ INTERVAL '1 day'"
    ]
  );

  assertCompiles(
    'Preset timeRange: last_30_days',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_30_days' },
      filters: []
    },
    [
      "orders\\.order_date >= CURRENT_DATE - INTERVAL '30 days'",
      "orders\\.order_date < CURRENT_DATE \\+ INTERVAL '1 day'"
    ]
  );

  assertCompiles(
    'Preset timeRange: this_month',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'this_month' },
      filters: []
    },
    [
      "orders\\.order_date >= DATE_TRUNC\\('month', CURRENT_DATE\\)",
      "orders\\.order_date < DATE_TRUNC\\('month', CURRENT_DATE\\) \\+ INTERVAL '1 month'"
    ]
  );

  assertCompiles(
    'Preset timeRange: this_year',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'this_year' },
      filters: []
    },
    [
      "orders\\.order_date >= DATE_TRUNC\\('year', CURRENT_DATE\\)",
      "orders\\.order_date < DATE_TRUNC\\('year', CURRENT_DATE\\) \\+ INTERVAL '1 year'"
    ]
  );

  assertCompiles(
    'Absolute timeRange start/end',
    {
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [],
      timeRange: { type: 'absolute', start: '2025-01-01', end: '2025-01-31' },
      filters: []
    },
    ["orders\\.order_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'"]
  );

  assertCompiles(
    'Filter operator: between',
    {
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [],
      filters: [{ field: 'order_date', operator: 'between', value: ['2025-01-01', '2025-01-31'] }]
    },
    ["orders\\.order_date BETWEEN '2025-01-01' AND '2025-01-31'"]
  );

  const returnAmountResult = assertCompiles(
    'Metric timeColumn selects non-orders fact time field',
    {
      intent: 'metric_query',
      metrics: [{ id: 'return_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_month' },
      filters: []
    },
    [
      "returns\\.return_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      "returns\\.return_date < DATE_TRUNC\\('month', CURRENT_DATE\\)"
    ]
  );

  assert.doesNotMatch(
    returnAmountResult.sql,
    /orders\.order_date/,
    'return_amount timeRange should not use orders.order_date'
  );

  const multiFactTimeRangeResult = assertCompiles(
    'Multi-pass timeRange applies per fact without dimensions',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_month' },
      filters: []
    },
    [
      "orders\\.order_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      "returns\\.return_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      'CROSS JOIN fact_1'
    ]
  );

  assert.doesNotMatch(
    multiFactTimeRangeResult.sql,
    /GROUP BY\s*\)/,
    'multi-pass aggregate CTEs without dimensions should not emit an empty GROUP BY'
  );

  const multiFactByCountryResult = assertCompiles(
    'Multi-pass timeRange applies per fact CTE with shared dimensions',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [{ id: 'user_country' }],
      timeRange: { type: 'preset', value: 'last_month' },
      filters: []
    },
    [
      'users\\.country AS dim_user_country',
      "orders\\.order_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      "returns\\.return_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      'FULL OUTER JOIN fact_1 ON fact_0\\.dim_user_country = fact_1\\.dim_user_country'
    ]
  );

  assertSqlContainsTimes(
    'Multi-pass timeRange applies per fact CTE with shared dimensions',
    multiFactByCountryResult.sql,
    'users\\.country AS dim_user_country',
    2
  );

  const multiFactFilterResult = assertCompiles(
    'Multi-pass filter joins filter entity into each fact CTE',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_30_days' },
      filters: [{ field: 'username', operator: '=', value: 'alice' }]
    },
    [
      'FROM orders JOIN users ON users\\.id = orders\\.user_id',
      'FROM returns JOIN users ON users\\.id = returns\\.user_id',
      "orders\\.order_date >= CURRENT_DATE - INTERVAL '30 days'",
      "returns\\.return_date >= CURRENT_DATE - INTERVAL '30 days'"
    ]
  );

  assertSqlContainsTimes(
    'Multi-pass filter joins filter entity into each fact CTE',
    multiFactFilterResult.sql,
    "users\\.username = 'alice'",
    2
  );

  const comparisonMultiFactResult = assertCompiles(
    'Comparison query preserves multi-pass compilation for multiple facts',
    {
      intent: 'comparison',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_month' },
      comparison: { type: 'MoM' },
      filters: []
    },
    [
      'WITH current_period AS \\(WITH fact_0 AS',
      "orders\\.order_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      "returns\\.return_date >= DATE_TRUNC\\('month', CURRENT_DATE - INTERVAL '1 month'\\)",
      "orders\\.order_date >= DATE_TRUNC\\('month', \\(CURRENT_DATE - INTERVAL '1 month'\\) - INTERVAL '1 month'\\)",
      "returns\\.return_date >= DATE_TRUNC\\('month', \\(CURRENT_DATE - INTERVAL '1 month'\\) - INTERVAL '1 month'\\)"
    ]
  );

  assert.match(
    comparisonMultiFactResult.sql,
    /historical_period AS \(\s+WITH fact_0 AS/s,
    'multi-fact comparison should build historical period from multi-pass SQL'
  );

  assert.throws(
    () => compiler.compile({
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [],
      filters: [{ field: 'product_category', operator: '=', value: '电子产品' }]
    }),
    (error) => error instanceof Error && /过滤字段不适用于当前 multi-pass CTE: product_category/.test(error.message),
    'multi-pass should fail explicitly when a filter cannot apply to every fact CTE without crossing another fact'
  );

  const noDefaultTimeLayer: SemanticLayer = {
    ...semanticLayer,
    entities: {
      ...semanticLayer.entities,
      orders: {
        ...(semanticLayer.entities.orders as any),
        defaultTimeColumn: undefined
      } as any
    },
    metrics: {
      ...semanticLayer.metrics,
      sales_amount: {
        ...semanticLayer.metrics.sales_amount,
        timeColumn: undefined
      }
    }
  };

  assert.throws(
    () => new SQLCompiler(noDefaultTimeLayer).compile({
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      timeRange: { type: 'preset', value: 'last_7_days' },
      filters: []
    }),
    (error) => error instanceof Error && /无法确定 timeRange 时间字段/.test(error.message),
    'timeRange should fail when no plan column, metric timeColumn, or entity default time field exists'
  );

  assertCompiles(
    'Calculated Metric (AOV)',
    {
      intent: 'metric_query',
      metrics: [{ id: 'aov' }],
      dimensions: [{ id: 'user_country' }],
      filters: []
    },
    ['SUM\\(orders\\.total_price\\)', 'COUNT\\(orders\\.id\\)']
  );

  assertCompileFails(
    'Unknown metric',
    {
      intent: 'metric_query',
      metrics: [{ id: 'gross_margin' }],
      dimensions: [],
      filters: []
    },
    '未知指标: gross_margin'
  );

  assertCompileFails(
    'Unknown dimension',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'market_segment' }],
      filters: []
    },
    '未知维度: market_segment'
  );

  assertCompileFails(
    'Unknown filter field',
    {
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [],
      filters: [{ field: 'gross_margin', operator: '>', value: 0.3 }]
    },
    '未知过滤字段: gross_margin'
  );

  const semanticQueryResult = await (dbTools.semanticQuery as any).execute({
    explanation: '查询语义层不存在的毛利率指标',
    plan: {
      intent: 'metric_query',
      metrics: [{ id: 'gross_margin' }],
      dimensions: [],
      filters: []
    }
  });

  assert.equal(semanticQueryResult.code, 'SEMANTIC_COMPILATION_FAILED');
  assert.equal(semanticQueryResult.executedSql, false);
  assert.match(semanticQueryResult.error, /未知指标: gross_margin/);
  assert.match(semanticQueryResult.hint, /listSemanticAtoms/);
  assert.match(semanticQueryResult.hint, /askClarification/);

  console.log('SQLCompiler semantic validation tests passed.');
}

runTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
