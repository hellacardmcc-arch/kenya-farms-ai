import pg from 'pg';

const SERVICE = 'admin-service';
const connStr = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';
const isRender = connStr.includes('render.com');

function buildConnectionString() {
  let url = connStr;
  if (isRender && !url.includes('sslmode=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}sslmode=require`;
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}application_name=${SERVICE}`;
}

function createPool() {
  const pool = new pg.Pool({
    connectionString: buildConnectionString(),
    max: isRender ? 5 : 10,
    idleTimeoutMillis: isRender ? 30000 : 60000,
    connectionTimeoutMillis: isRender ? 60000 : 10000,
    keepAlive: true,
    ...(isRender && { ssl: { rejectUnauthorized: false } }),
  });
  pool.on('error', (err) => {
    console.error(`[${SERVICE}] Pool error:`, err.message);
  });
  return pool;
}

let pool = createPool();

function isConnectionError(err) {
  const code = err?.code;
  const msg = (err?.message || '').toLowerCase();
  return (
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P03', 'ENOTCONN'].includes(code) ||
    /connection.*terminated|connection.*closed|connection.*refused|socket.*hang/i.test(msg)
  );
}

async function recreatePool() {
  try {
    await pool.end();
  } catch (_) {}
  pool = createPool();
  await pool.query('SELECT 1');
}

export async function query(text, params) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        return await client.query(text, params);
      } finally {
        client.release();
      }
    } catch (err) {
      if (isConnectionError(err) && attempt < maxRetries) {
        console.warn(`[${SERVICE}] DB connection failed (attempt ${attempt}/${maxRetries}), reconnecting...`, err.message);
        try {
          await recreatePool();
        } catch (reconnectErr) {
          console.error(`[${SERVICE}] Reconnect failed:`, reconnectErr.message);
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
}

export async function reconnect() {
  const maxRetries = isRender ? 4 : 2;
  const delayMs = isRender ? 15000 : 2000; // Render free tier DB can take 30-60s to wake
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await recreatePool();
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        console.warn(`[${SERVICE}] Reconnect attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs / 1000}s...`, err.message);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  const hint = isRender
    ? ' Render free tier DB may be sleeping—try again in 30-60 seconds, or ensure Internal Database URL is set.'
    : '';
  throw new Error(`${lastErr?.message || 'Connection failed'}${hint}`);
}

export async function checkConnection() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    const msg = err?.code === 'ECONNREFUSED'
      ? 'PostgreSQL not reachable. Start databases: docker-compose up -d'
      : err?.message;
    throw new Error(`Database connection failed: ${msg}`);
  }
}
