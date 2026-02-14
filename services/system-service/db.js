import pg from 'pg';

const connStr = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';
const isRender = connStr.includes('render.com');
const pool = new pg.Pool({
  connectionString: isRender && !connStr.includes('sslmode=') ? `${connStr}${connStr.includes('?') ? '&' : '?'}sslmode=require` : connStr,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(isRender && { ssl: { rejectUnauthorized: false } }),
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
