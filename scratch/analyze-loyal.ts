import { PostgresDataSource } from '../src/lib/db-connector';

async function main() {
  const ds = new PostgresDataSource(process.env.DATABASE_URL || '');

  try {
    // 核心忠诚客户：下单>=2次 且 总消费>10000
    console.log('========== 核心忠诚客户完整画像 ==========');
    const loyal = await ds.executeQuery(`
      WITH customer_stats AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.country,
          EXTRACT(YEAR FROM AGE(NOW(), u.joined_at)) as membership_years,
          COUNT(DISTINCT o.id)::int as order_count,
          COALESCE(SUM(o.total_price), 0)::numeric(10,2) as total_spent,
          COALESCE(AVG(o.total_price), 0)::numeric(10,2) as avg_order_value,
          MIN(o.order_date) as first_order_date,
          MAX(o.order_date) as last_order_date,
          EXTRACT(DAY FROM DATE '2024-05-10' - MAX(o.order_date))::int as days_since_last_order,
          COALESCE(SUM(r.amount), 0)::numeric(10,2) as total_return_amount,
          CASE WHEN COALESCE(SUM(o.total_price), 0) > 0 
            THEN ROUND(COALESCE(SUM(r.amount), 0) / COALESCE(SUM(o.total_price), 0) * 100, 1)
            ELSE 0 END as return_rate_pct
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        LEFT JOIN returns r ON u.id = r.user_id
        GROUP BY u.id, u.username, u.country, u.joined_at
      )
      SELECT *,
        CASE 
          WHEN order_count >= 2 AND total_spent > 10000 THEN '核心忠诚客户'
          WHEN order_count >= 2 AND total_spent BETWEEN 5000 AND 10000 THEN '高价值常客'
          WHEN order_count >= 1 AND total_spent > 0 THEN '普通客户'
          ELSE '沉默客户'
        END as segment
      FROM customer_stats
      ORDER BY total_spent DESC
    `);
    console.table(loyal.rows);

    // 核心忠诚客户的商品偏好
    console.log('\n========== 核心忠诚客户购买商品明细 ==========');
    const products = await ds.executeQuery(`
      SELECT u.username, o.order_date, p.name as product, p.category, o.quantity, o.total_price
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      WHERE u.id IN (
        SELECT u.id FROM users u
        JOIN orders o ON u.id = o.user_id
        GROUP BY u.id
        HAVING COUNT(DISTINCT o.id) >= 2 AND SUM(o.total_price) > 10000
      )
      ORDER BY u.id, o.order_date
    `);
    console.table(products.rows);

    // 二八分析 - 前20%客户贡献了多少收入
    console.log('\n========== 二八法则分析 ==========');
    const pareto = await ds.executeQuery(`
      WITH customer_revenue AS (
        SELECT u.id, u.username, COALESCE(SUM(o.total_price), 0) as revenue
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.username
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) as rn,
          COUNT(*) OVER () as total_customers
        FROM customer_revenue
      )
      SELECT 
        CASE WHEN rn <= ROUND(total_customers * 0.2) THEN 'Top 20% 客户' ELSE '其余 80% 客户' END as group_name,
        COUNT(*) as customer_count,
        ROUND(SUM(revenue), 2) as total_revenue,
        ROUND(AVG(revenue), 2) as avg_revenue,
        ROUND(SUM(revenue) * 100.0 / (SELECT SUM(revenue) FROM customer_revenue), 1) as revenue_share_pct
      FROM ranked
      GROUP BY CASE WHEN rn <= ROUND(total_customers * 0.2) THEN 'Top 20% 客户' ELSE '其余 80% 客户' END
    `);
    console.table(pareto.rows);

  } finally {
    await ds.close();
  }
}

main().catch(console.error);
