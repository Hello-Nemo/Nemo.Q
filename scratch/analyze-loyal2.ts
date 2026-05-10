import { PostgresDataSource } from '../src/lib/db-connector';

async function main() {
  const ds = new PostgresDataSource(process.env.DATABASE_URL || '');

  try {
    // 核心忠诚客户：下单>=2次 且 总消费>10000 (numeric comparison fix)
    console.log('========== 1. 所有客户价值分层 ==========');
    const allCustomers = await ds.executeQuery(`
      WITH customer_stats AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.country,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(o.total_price), 0) as total_spent,
          COALESCE(AVG(o.total_price), 0) as avg_order_value,
          MIN(o.order_date) as first_order_date,
          MAX(o.order_date) as last_order_date,
          EXTRACT(DAY FROM DATE '2024-05-10' - MAX(o.order_date)) as days_since_last_order,
          COALESCE(SUM(r.amount), 0) as total_return_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        LEFT JOIN returns r ON u.id = r.user_id
        GROUP BY u.id, u.username, u.country
      )
      SELECT *,
        CASE 
          WHEN order_count::int >= 2 AND total_spent::numeric > 10000 THEN '核心忠诚客户'
          WHEN order_count::int >= 2 AND total_spent::numeric BETWEEN 5000 AND 10000 THEN '高价值常客'
          WHEN order_count::int >= 1 AND total_spent::numeric > 0 THEN '普通客户'
          ELSE '沉默客户'
        END as segment
      FROM customer_stats
      ORDER BY total_spent DESC
    `);
    console.table(allCustomers.rows);

    // 2. 分层汇总统计
    console.log('\n========== 2. 分层汇总统计 ==========');
    const segments = await ds.executeQuery(`
      WITH customer_stats AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.country,
          COUNT(DISTINCT o.id)::int as order_count,
          COALESCE(SUM(o.total_price), 0)::numeric(10,2) as total_spent,
          COALESCE(AVG(o.total_price), 0)::numeric(10,2) as avg_order_value,
          MAX(o.order_date) as last_order_date,
          MIN(o.order_date) as first_order_date,
          COALESCE(SUM(r.amount), 0)::numeric(10,2) as total_return_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        LEFT JOIN returns r ON u.id = r.user_id
        GROUP BY u.id, u.username, u.country
      ),
      segmented AS (
        SELECT *,
          CASE 
            WHEN order_count >= 2 AND total_spent > 10000 THEN '核心忠诚客户'
            WHEN order_count >= 2 AND total_spent BETWEEN 5000 AND 10000 THEN '高价值常客'
            WHEN order_count >= 1 AND total_spent > 0 THEN '普通客户'
            ELSE '沉默客户'
          END as segment
        FROM customer_stats
      )
      SELECT 
        segment,
        COUNT(*)::int as customer_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM segmented), 1) as pct,
        ROUND(SUM(total_spent), 2) as total_revenue,
        ROUND(AVG(total_spent), 2) as avg_revenue,
        ROUND(SUM(total_spent) * 100.0 / (SELECT SUM(total_spent) FROM segmented), 1) as revenue_share_pct
      FROM segmented
      GROUP BY segment
      ORDER BY MIN(total_spent) DESC
    `);
    console.table(segments.rows);

  } finally {
    await ds.close();
  }
}

main().catch(console.error);
