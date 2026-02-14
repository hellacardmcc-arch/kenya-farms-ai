import pg from 'pg';

const connStr = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';
const isRender = connStr.includes('render.com');
const poolConfig = {
  connectionString: isRender && !connStr.includes('sslmode=') ? `${connStr}${connStr.includes('?') ? '&' : '?'}sslmode=require` : connStr,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(isRender && { ssl: { rejectUnauthorized: false } }),
};

let pool = new pg.Pool(poolConfig);

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/** Force reconnect: end current pool and create a new one. Use when DB was disconnected. */
export async function reconnect() {
  try {
    await pool.end();
  } catch (_) {}
  pool = new pg.Pool(poolConfig);
  await pool.query('SELECT 1');
}
