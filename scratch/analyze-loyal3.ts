import { PostgresDataSource } from '../src/lib/db-connector';

async function main() {
  const ds = new PostgresDataSource(process.env.DATABASE_URL || '');

  try {
    // raw query to see types
    console.log('========== Raw customer data ==========');
    const raw = await ds.executeQuery(`
      SELECT u.id, u.username, u.country, 
        COUNT(DISTINCT o.id) as c1,
        COALESCE(SUM(o.total_price), 0) as c2
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id, u.username, u.country
      ORDER BY c2 DESC
    `);
    console.log(JSON.stringify(raw.rows, null, 2));
    
    // Simple CASE test
    console.log('\n========== Simple segment test ==========');
    const simple = await ds.executeQuery(`
      SELECT * FROM (
        SELECT u.id, u.username, u.country, COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(o.total_price), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.username, u.country
      ) sub
      ORDER BY total_spent DESC
    `);
    console.log(JSON.stringify(simple.rows, null, 2));

    // Try with explicit cast
    console.log('\n========== Segment with CASE ==========');
    const seg = await ds.executeQuery(`
      WITH stats AS (
        SELECT u.id, u.username, u.country,
          COUNT(DISTINCT o.id) AS order_count,
          COALESCE(SUM(o.total_price), 0) AS total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.username, u.country
      )
      SELECT id, username, country, order_count, total_spent,
        CASE 
          WHEN order_count >= 2 AND total_spent > 10000 THEN '核心忠诚客户'
          WHEN order_count >= 2 AND total_spent >= 5000 AND total_spent <= 10000 THEN '高价值常客'
          WHEN order_count >= 1 AND total_spent > 0 THEN '普通客户'
          ELSE '沉默客户'
        END as segment
      FROM stats
      ORDER BY total_spent DESC
    `);
    console.log(JSON.stringify(seg.rows, null, 2));

  } finally {
    await ds.close();
  }
}

main().catch(console.error);
