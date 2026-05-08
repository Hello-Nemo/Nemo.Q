import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SQLCompiler } from './compiler';
import type { AnalysisPlan, QueryPlan, SemanticLayer } from './types';

function loadSemanticLayer(): SemanticLayer {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
  );
}

function compile(plan: QueryPlan, layer = loadSemanticLayer()) {
  return new SQLCompiler(layer).compile(plan);
}

function compileAnalysis(plan: AnalysisPlan, layer = loadSemanticLayer()) {
  return new SQLCompiler(layer).compileAnalysis(plan);
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
      `"SELECT users.country AS "user_country", SUM(orders.total_price) AS "sales_amount" FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1"`
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
      `"SELECT CASE WHEN users.age < 18 THEN '未成年' WHEN users.age < 35 THEN '青年' WHEN users.age < 60 THEN '中年' ELSE '老年' END AS "age_group", COUNT(orders.id) AS "order_count" FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND orders.order_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY 1"`
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
      `"WITH fact_0 AS (SELECT users.country AS "dim_user_country", SUM(orders.total_price) AS "sales_amount" FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1), fact_1 AS (SELECT users.country AS "dim_user_country", SUM(returns.amount) AS "return_amount" FROM returns JOIN users ON users.id = returns.user_id GROUP BY 1) SELECT COALESCE(fact_0."dim_user_country", fact_1."dim_user_country") AS "user_country", fact_0."sales_amount", fact_1."return_amount" FROM fact_0 FULL OUTER JOIN fact_1 ON fact_0."dim_user_country" = fact_1."dim_user_country""`
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
    expect(result.sql).toMatchInlineSnapshot(`"WITH current_period AS (SELECT users.country AS "user_country", SUM(orders.total_price) AS "sales_amount" FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', CURRENT_DATE) AND orders.order_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' GROUP BY 1), historical_period AS (SELECT users.country AS "user_country", SUM(orders.total_price) AS "sales_amount" FROM orders JOIN users ON users.id = orders.user_id WHERE orders.order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND orders.order_date < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '1 month' GROUP BY 1) SELECT COALESCE(current_period."user_country", historical_period."user_country") AS "user_country", current_period."sales_amount" AS "sales_amount", historical_period."sales_amount" AS "sales_amount_prev", (current_period."sales_amount" - historical_period."sales_amount") / NULLIF(historical_period."sales_amount", 0) AS "sales_amount_growth" FROM current_period FULL OUTER JOIN historical_period ON current_period."user_country" = historical_period."user_country""`);
  });

  it('compiles Comparison sales_amount YoY by order_month', () => {
    const result = compile({
      intent: 'comparison',
      metrics: [{ id: 'sales_amount' }],
      dimensions: [{ id: 'order_month' }],
      timeRange: { type: 'preset', value: 'this_year' },
      comparison: { type: 'YoY' },
      filters: [],
      orderBy: [{ field: 'order_month', direction: 'asc' }]
    });

    expect(result.lineage.type).toBe('Comparison');
    expect(result.certification.isCertified).toBe(true);
    expect(result.sql).toContain("DATE_TRUNC('month', orders.order_date)::date AS \"order_month\"");
    expect(result.sql).toContain("DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')");
    expect(result.sql).toContain('current_period."order_month" = historical_period."order_month" + INTERVAL \'1 year\'');
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
      `"SELECT COUNT(orders.id) AS "order_count" FROM orders WHERE orders.order_date BETWEEN '2025-01-01' AND '2025-01-31'"`
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
      `"SELECT COUNT(orders.id) AS "order_count" FROM orders WHERE orders.order_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31'"`
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
      `"SELECT users.country AS "user_country", SUM(orders.total_price) AS "sales_amount" FROM orders JOIN users ON users.id = orders.user_id GROUP BY 1 ORDER BY sales_amount desc LIMIT 5"`
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

  it('compiles retention AnalysisPlan into auditable template SQL', () => {
    const result = compileAnalysis({
      intent: 'analysis',
      template: 'retention',
      entity: {
        id: 'users',
        column: 'users.id',
        label: '注册用户'
      },
      cohortEvent: {
        id: 'new_user_signup',
        name: '新用户注册',
        entityId: 'users',
        actorColumn: 'users.id',
        timestampColumn: 'users.joined_at'
      },
      returnEvent: {
        id: 'place_order',
        name: '下单',
        entityId: 'orders',
        actorColumn: 'orders.user_id',
        timestampColumn: 'orders.order_date'
      },
      timeRange: { type: 'preset', value: 'last_30_days' },
      retentionWindow: { value: 7, unit: 'day' },
      grain: 'day'
    });

    expect(result.lineage).toEqual({
      path: ['users', 'orders'],
      entities: ['users', 'orders'],
      metrics: [],
      dimensions: [],
      isMultiPass: false,
      type: 'Analysis'
    });
    expect(result.analysis).toMatchObject({
      template: 'retention',
      entity: {
        id: 'users',
        column: 'users.id',
        label: '注册用户'
      },
      timeWindow: {
        type: 'preset',
        value: 'last_30_days'
      },
      parameters: {
        retentionWindow: '7 days',
        grain: 'day'
      },
      events: [
        {
          id: 'new_user_signup',
          name: '新用户注册',
          entityId: 'users',
          actorColumn: 'users.id',
          timestampColumn: 'users.joined_at'
        },
        {
          id: 'place_order',
          name: '下单',
          entityId: 'orders',
          actorColumn: 'orders.user_id',
          timestampColumn: 'orders.order_date'
        }
      ]
    });
    expect(result.sql).toMatchInlineSnapshot(`
      "WITH cohort AS (SELECT users.id AS entity_id, DATE_TRUNC('day', users.joined_at)::date AS cohort_start FROM users WHERE users.joined_at >= CURRENT_DATE - INTERVAL '30 days' AND users.joined_at < CURRENT_DATE + INTERVAL '1 day'), return_events AS (SELECT orders.user_id AS entity_id, orders.order_date AS event_at FROM orders), retention AS (SELECT cohort.cohort_start, COUNT(DISTINCT cohort.entity_id) AS cohort_size, COUNT(DISTINCT return_events.entity_id) AS retained_entities FROM cohort LEFT JOIN return_events ON return_events.entity_id = cohort.entity_id AND return_events.event_at > cohort.cohort_start AND return_events.event_at <= cohort.cohort_start + INTERVAL '7 days' GROUP BY 1) SELECT cohort_start, cohort_size, retained_entities, retained_entities::decimal / NULLIF(cohort_size, 0) AS retention_rate FROM retention ORDER BY cohort_start"
    `);
  });

  it('compiles funnel, cohort, and path_sequence analysis templates', () => {
    const baseEvent = {
      id: 'signup',
      name: '注册',
      entityId: 'users',
      actorColumn: 'users.id',
      timestampColumn: 'users.joined_at'
    };
    const orderEvent = {
      id: 'order',
      name: '下单',
      entityId: 'orders',
      actorColumn: 'orders.user_id',
      timestampColumn: 'orders.order_date'
    };

    const funnel = compileAnalysis({
      intent: 'analysis',
      template: 'funnel',
      entity: { id: 'users', column: 'users.id' },
      steps: [baseEvent, orderEvent],
      timeRange: { type: 'preset', value: 'last_30_days' },
      conversionWindow: { value: 7, unit: 'day' }
    });

    expect(funnel.analysis?.template).toBe('funnel');
    expect(funnel.sql).toContain("SELECT 1 AS step_index, '注册' AS step_name");
    expect(funnel.sql).toContain("event_at <= step_1_at + INTERVAL '7 days'");

    const cohort = compileAnalysis({
      intent: 'analysis',
      template: 'cohort',
      entity: { id: 'users', column: 'users.id' },
      cohortEvent: baseEvent,
      timeRange: { type: 'preset', value: 'last_30_days' },
      grain: 'month'
    });

    expect(cohort.analysis?.template).toBe('cohort');
    expect(cohort.sql).toContain("DATE_TRUNC('month', users.joined_at)::date AS cohort_start");

    const pathSequence = compileAnalysis({
      intent: 'analysis',
      template: 'path_sequence',
      entity: { id: 'users', column: 'users.id' },
      events: [baseEvent, orderEvent],
      timeRange: { type: 'preset', value: 'last_30_days' },
      limit: 5
    });

    expect(pathSequence.analysis?.template).toBe('path_sequence');
    expect(pathSequence.sql).toContain('LEAD(event_name) OVER (PARTITION BY entity_id ORDER BY event_at, event_name) AS next_event');
    expect(pathSequence.sql).toContain('LIMIT 5');
  });
});
