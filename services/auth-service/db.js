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

pool.on('error', (err) => {
  console.error('[auth-service] PostgreSQL pool error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('[auth-service] Database not reachable. Start Docker: docker-compose up -d');
  }
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function getPool() {
  return pool;
}

/** Verify DB connection on startup. Throws with clear message if unreachable. */
export async function checkConnection() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    const msg = err.code === 'ECONNREFUSED'
      ? 'PostgreSQL not reachable at localhost:5432. Start databases: docker-compose up -d'
      : err.message;
    throw new Error(`Database connection failed: ${msg}`);
  }
}
