import { SQLCompiler } from './compiler';
import { SemanticLayer, QueryPlan } from './types';
import fs from 'fs';
import path from 'path';

function runTest() {
  const semanticLayer: SemanticLayer = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
  );

  const compiler = new SQLCompiler(semanticLayer);

  const tests: Array<{ name: string; plan: QueryPlan }> = [
    {
      name: 'Basic Metric Query',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'sales_amount' }],
        dimensions: [{ id: 'user_country' }],
        filters: [],
        limit: 10
      }
    },
    {
      name: 'Time Range & Filter Query',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'order_count' }],
        dimensions: [{ id: 'product_category' }],
        timeRange: { type: 'preset', value: 'last_month' },
        filters: [{ field: 'products.category', operator: '=', value: 'Electronics' }],
        orderBy: [{ field: 'order_count', direction: 'desc' }]
      }
    },
    {
      name: 'Multi-Entity Join Query',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'sales_amount' }],
        dimensions: [{ id: 'username' }, { id: 'user_country' }],
        filters: [],
        orderBy: [{ field: 'sales_amount', direction: 'desc' }],
        limit: 5
      }
    },
    {
      name: 'Pure Aggregation (No Dimensions)',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'sales_amount' }, { id: 'order_count' }],
        dimensions: [],
        filters: [{ field: 'users.country', operator: '=', value: 'China' }]
      }
    },
    {
      name: 'Complex Filters (IN operator)',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'order_count' }],
        dimensions: [{ id: 'product_category' }],
        filters: [{ field: 'product_category', operator: 'in', value: ['Electronics', 'Furniture'] }]
      }
    },
    {
      name: 'Multi-Dimension Cross Analysis',
      plan: {
        intent: 'comparison',
        metrics: [{ id: 'sales_amount' }],
        dimensions: [{ id: 'user_country' }, { id: 'product_category' }],
        filters: [],
        orderBy: [{ field: 'user_country', direction: 'asc' }, { field: 'sales_amount', direction: 'desc' }]
      }
    },
    {
      name: 'Chasm Trap (Multi-Fact Query)',
      plan: {
        intent: 'metric_query',
        metrics: [{ id: 'sales_amount' }, { id: 'return_amount' }],
        dimensions: [{ id: 'user_country' }],
        filters: []
      }
    }
  ];



  tests.forEach(test => {
    console.log(`--- Test: ${test.name} ---`);
    try {
      const sql = compiler.compile(test.plan);
      console.log('Generated SQL:');
      console.log(sql);
      console.log('\n');
    } catch (e: any) {
      console.error(`Error in ${test.name}:`, e.message);
    }
  });
}

runTest();
