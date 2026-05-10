import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  console.log('Connecting to:', process.env.DATABASE_URL);
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success:', res.rows[0]);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

test();
