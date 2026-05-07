import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SQLCompiler } from './compiler';
import type { QueryPlan, SemanticLayer } from './types';

function loadSemanticLayer(): SemanticLayer {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
  );
}

function compile(plan: QueryPlan, layer = loadSemanticLayer()) {
  return new SQLCompiler(layer).compile(plan);
}

describe('SQLCompiler deterministic unit tests', () => {
  it('compiles SinglePass sales_amount by user_country', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'user_country' }],
      filters: []
    });

    expect(result.lineage).toEqual({
      path: ['orders', 'users'],
      entities: ['orders', 'users'],
      metrics: ['sales_amount'],
      dimensions: ['user_country'],
      isMultiPass: false,
      type: 'SinglePass'
    });
    expect(result.sql).toMatchInlineSnapshot(
      `"SELECT users.country AS user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1"`
    );
  });

  it('compiles SinglePass order_count by age_group for last_month', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [{ id: 'age_group' }],
      timeRange: { type: 'preset', value: 'last_month' },
      filters: []
    });

    expect(result.lineage.type).toBe('SinglePass');
    expect(result.sql).toMatchInlineSnapshot(
      `"SELECT CASE WHEN users.age < 18 THEN '未成年' WHEN users.age < 35 THEN '青年' WHEN users.age < 60 THEN '中年' ELSE '老年' END AS age_group, COUNT(orders.id) AS order_count FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND orders.order_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY 1"`
    );
  });

  it('compiles MultiPass sales_amount and return_amount by user_country', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
      dimensions: [{ id: 'user_country' }],
      filters: []
    });

    expect(result.lineage).toEqual({
      path: ['orders', 'users', 'returns'],
      entities: ['orders', 'returns', 'users'],
      metrics: ['sales_amount', 'return_amount'],
      dimensions: ['user_country'],
      isMultiPass: true,
      type: 'MultiPass'
    });
    expect(result.sql).toMatchInlineSnapshot(
      `"WITH fact_0 AS (SELECT users.country AS dim_user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1), fact_1 AS (SELECT users.country AS dim_user_country, SUM(returns.amount) AS return_amount FROM returns JOIN users ON users.id = returns.user_id GROUP BY 1) SELECT COALESCE(fact_0.dim_user_country, fact_1.dim_user_country) AS user_country, fact_0.sales_amount, fact_1.return_amount FROM fact_0 FULL OUTER JOIN fact_1 ON fact_0.dim_user_country = fact_1.dim_user_country"`
    );
  });

  it('compiles Comparison sales_amount MoM by user_country', () => {
    const result = compile({
      intent: 'comparison',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'user_country' }],
      timeRange: { type: 'preset', value: 'this_month' },
      comparison: { type: 'MoM' },
      filters: []
    });

    expect(result.lineage.type).toBe('Comparison');
    expect(result.sql).toMatchInlineSnapshot(`
      "WITH current_period AS (SELECT users.country AS user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', CURRENT_DATE) AND orders.order_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' GROUP BY 1), historical_period AS (
              SELECT users.country AS user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', (CURRENT_DATE - INTERVAL '1 month')) AND orders.order_date < DATE_TRUNC('month', (CURRENT_DATE - INTERVAL '1 month')) + INTERVAL '1 month' GROUP BY 1
            ) SELECT current_period.user_country, current_period.sales_amount AS sales_amount, historical_period.sales_amount AS sales_amount_prev, (current_period.sales_amount - historical_period.sales_amount) / NULLIF(historical_period.sales_amount, 0) AS sales_amount_growth FROM current_period LEFT JOIN historical_period ON current_period.user_country = historical_period.user_country"
    `);
  });

  it('throws for an unknown metric', () => {
    expect(() =>
      compile({
        intent: 'metric_query',
        metrics: [{ id: 'gross_margin' }],
        dimensions: [],
        filters: []
      })
    ).toThrow('未知指标: gross_margin');
  });

  it('throws for an unknown dimension', () => {
    expect(() =>
      compile({
        intent: 'metric_query',
        metrics: [{ id: 'sales_amount' }],
        dimensions: [{ id: 'market_segment' }],
        filters: []
      })
    ).toThrow('未知维度: market_segment');
  });

  it('compiles between filters', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [],
      filters: [{ field: 'order_date', operator: 'between', value: ['2025-01-01', '2025-01-31'] }]
    });

    expect(result.sql).toMatchInlineSnapshot(
      `"SELECT COUNT(orders.id) AS order_count FROM orders WHERE orders.order_date BETWEEN '2025-01-01' AND '2025-01-31'"`
    );
  });

  it('compiles absolute timeRange', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'order_count' }],
      dimensions: [],
      timeRange: { type: 'absolute', start: '2025-01-01', end: '2025-01-31' },
      filters: []
    });

    expect(result.sql).toMatchInlineSnapshot(
      `"SELECT COUNT(orders.id) AS order_count FROM orders WHERE orders.order_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'"`
    );
  });

  it('compiles orderBy and limit', () => {
    const result = compile({
      intent: 'metric_query',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'user_country' }],
      filters: [],
      orderBy: [{ field: 'sales_amount', direction: 'desc' }],
      limit: 5
    });

    expect(result.sql).toMatchInlineSnapshot(
      `"SELECT users.country AS user_country, SUM(orders.total_price) AS sales_amount FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1 ORDER BY sales_amount desc LIMIT 5"`
    );
  });

  it('throws when no join path exists', () => {
    const semanticLayer = loadSemanticLayer();
    const noJoinLayer: SemanticLayer = {
      ...semanticLayer,
      relationships: semanticLayer.relationships.filter(
        (relationship) =>
          !(relationship.fromEntityId === 'users' && relationship.toEntityId === 'orders')
      )
    };

    expect(() =>
      compile(
        {
          intent: 'metric_query',
          metrics: [{ id: 'sales_amount' }],
          dimensions: [{ id: 'user_country' }],
          filters: []
        },
        noJoinLayer
      )
    ).toThrow('无法找到路径连接实体: users');
  });
});
