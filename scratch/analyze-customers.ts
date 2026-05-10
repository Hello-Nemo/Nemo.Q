import { PostgresDataSource } from '../src/lib/db-connector';

async function main() {
  const ds = new PostgresDataSource(process.env.DATABASE_URL || '');

  try {
    // 1. 获取基础客户信息
    console.log('========== 1. 客户基础信息 ==========');
    const users = await ds.executeQuery(`
      SELECT u.id, u.username, u.email, u.country, u.joined_at,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_price), 0) as total_spent,
        MAX(o.order_date) as last_order_date,
        EXTRACT(DAY FROM NOW() - MAX(o.order_date)) as days_since_last_order
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id, u.username, u.email, u.country, u.joined_at
      ORDER BY total_spent DESC
    `);
    console.log('用户消费总览:');
    console.table(users.rows);

    // 2. 每位客户的详细订单
    console.log('\n========== 2. 客户详细订单 ==========');
    const orderDetails = await ds.executeQuery(`
      SELECT u.id as user_id, u.username, u.country,
        o.id as order_id, o.order_date, o.quantity, o.total_price,
        p.name as product_name, p.category as product_category
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      ORDER BY u.id, o.order_date
    `);
    console.log('客户订单明细:');
    console.table(orderDetails.rows);

    // 3. 退货情况
    console.log('\n========== 3. 客户退货情况 ==========');
    const returns = await ds.executeQuery(`
      SELECT u.id as user_id, u.username,
        COUNT(r.id) as return_count,
        COALESCE(SUM(r.amount), 0) as total_return_amount
      FROM users u
      LEFT JOIN returns r ON u.id = r.user_id
      GROUP BY u.id, u.username
      ORDER BY return_count DESC
    `);
    console.log('客户退货统计:');
    console.table(returns.rows);

    // 4. 客户分层分析（按消费金额和频次）
    console.log('\n========== 4. 客户价值分层 ==========');
    const segments = await ds.executeQuery(`
      WITH customer_stats AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.country,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(o.total_price), 0) as total_spent,
          COALESCE(AVG(o.total_price), 0) as avg_order_value,
          MAX(o.order_date) as last_order_date,
          CASE 
            WHEN COUNT(DISTINCT o.id) >= 2 AND COALESCE(SUM(o.total_price), 0) > 10000 THEN '核心忠诚客户'
            WHEN COUNT(DISTINCT o.id) >= 2 AND COALESCE(SUM(o.total_price), 0) BETWEEN 5000 AND 10000 THEN '高价值常客'
            WHEN COUNT(DISTINCT o.id) >= 1 AND COALESCE(SUM(o.total_price), 0) > 0 THEN '普通客户'
            ELSE '沉默客户'
          END as customer_segment
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.username, u.country
      )
      SELECT 
        customer_segment,
        COUNT(*) as customer_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM customer_stats), 1) as pct,
        ROUND(SUM(total_spent), 2) as total_revenue,
        ROUND(AVG(total_spent), 2) as avg_revenue_per_customer,
        ROUND(AVG(order_count), 1) as avg_orders_per_customer,
        ROUND(SUM(total_spent) * 100.0 / (SELECT SUM(total_spent) FROM customer_stats), 1) as revenue_pct
      FROM customer_stats
      GROUP BY customer_segment
      ORDER BY MIN(total_spent) DESC
    `);
    console.log('客户分层统计:');
    console.table(segments.rows);

    // 5. 核心忠诚客户画像
    console.log('\n========== 5. 核心忠诚客户画像 ==========');
    const loyalCustomers = await ds.executeQuery(`
      WITH customer_stats AS (
        SELECT 
          u.id as user_id,
          u.username,
          u.country,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(o.total_price), 0) as total_spent,
          COALESCE(AVG(o.total_price), 0) as avg_order_value,
          MAX(o.order_date) as last_order_date,
          MIN(o.order_date) as first_order_date,
          COALESCE(SUM(r.amount), 0) as total_return_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        LEFT JOIN returns r ON u.id = r.user_id
        GROUP BY u.id, u.username, u.country
      )
      SELECT *,
        CASE 
          WHEN order_count >= 2 AND total_spent > 10000 THEN '核心忠诚客户'
          ELSE ''
        END as segment
      FROM customer_stats
      WHERE order_count >= 2 AND total_spent > 10000
      ORDER BY total_spent DESC
    `);
    console.log('核心忠诚客户:');
    console.table(loyalCustomers.rows);

  } finally {
    await ds.close();
  }
}

main().catch(console.error);
