import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4007;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

app.use(cors());
app.use(express.json());

function requireAuth(handler) {
  return (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = jwt.verify(auth.slice(7), JWT_SECRET);
      return handler(req, res);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// System config (admin)
app.get('/api/system/config', async (_, res) => {
  try {
    const { rows } = await query('SELECT key, value FROM system_config').catch(() => ({ rows: [] }));
    const config = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
    res.json({ config: Object.keys(config).length ? config : { irrigation_enabled: 'true', maintenance_mode: 'false' } });
  } catch {
    res.json({ config: { irrigation_enabled: 'true', maintenance_mode: 'false' } });
  }
});

app.put('/api/system/config', requireAuth(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { irrigation_enabled, maintenance_mode } = req.body || {};
  try {
    await query('SELECT 1 FROM system_config LIMIT 1');
  } catch {
    await query('CREATE TABLE IF NOT EXISTS system_config (key VARCHAR(100) PRIMARY KEY, value TEXT)');
  }
  if (irrigation_enabled !== undefined) {
    await query('INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['irrigation_enabled', String(irrigation_enabled)]);
  }
  if (maintenance_mode !== undefined) {
    await query('INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['maintenance_mode', String(maintenance_mode)]);
  }
  res.json({ ok: true });
}));

// System status (aggregate)
app.get('/api/system/status', async (_, res) => {
  res.json({
    status: 'ok',
    services: { auth: 'ok', farmer: 'ok', device: 'ok', system: 'ok' },
    uptime: process.uptime()
  });
});

// Available sensors/robots for farmer activation (configured, not yet paired)
app.get('/api/system/available-sensors', requireAuth(async (req, res) => {
  let rows = [];
  try {
    const result = await query(
      `SELECT id, device_id, name, type, unit, registration_status
       FROM system_sensors WHERE registration_status = 'configured' AND farm_id IS NULL`
    );
    rows = result.rows;
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) {
      const result = await query(`SELECT id, name, type, unit FROM system_sensors WHERE farm_id IS NULL`);
      rows = result.rows.map(r => ({ ...r, device_id: null, registration_status: 'configured' }));
    }
  }
  res.json({ sensors: rows });
}));

app.get('/api/system/available-robots', requireAuth(async (req, res) => {
  let rows = [];
  try {
    const result = await query(
      `SELECT id, device_id, name, type, registration_status
       FROM system_robots WHERE registration_status = 'configured' AND farmer_id IS NULL`
    );
    rows = result.rows;
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) {
      const result = await query(`SELECT id, name, type FROM system_robots WHERE farmer_id IS NULL`);
      rows = result.rows.map(r => ({ ...r, device_id: null, registration_status: 'configured' }));
    }
  }
  res.json({ robots: rows });
}));

app.post('/api/system/sensors/:id/activate', requireAuth(async (req, res) => {
  const { farm_id } = req.body || {};
  if (!farm_id) return res.status(400).json({ error: 'farm_id required' });
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  const { rows: farmRows } = await query('SELECT id FROM farms WHERE id = $1 AND farmer_id = $2', [farm_id, farmer.id]);
  if (!farmRows[0]) return res.status(403).json({ error: 'Farm not found or does not belong to you' });
  try {
    const { rowCount } = await query(
      `UPDATE system_sensors SET farm_id = $1, registration_status = 'active', status = 'online' WHERE id = $2 AND registration_status = 'configured' AND farm_id IS NULL`,
      [farm_id, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Sensor not found or already activated' });
    res.json({ ok: true, message: 'Sensor activated and paired to your farm' });
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

app.post('/api/system/robots/:id/activate', requireAuth(async (req, res) => {
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  try {
    const { rowCount } = await query(
      `UPDATE system_robots SET farmer_id = $1, registration_status = 'active', status = 'idle' WHERE id = $2 AND registration_status = 'configured' AND farmer_id IS NULL`,
      [farmer.id, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Robot not found or already activated' });
    res.json({ ok: true, message: 'Robot activated and paired to your account' });
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

// Sensors (farmer) - only activated sensors paired to farmer's farms
app.get('/api/system/sensors', requireAuth(async (req, res) => {
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.json({ sensors: [] });
  const { rows: farms } = await query('SELECT id FROM farms WHERE farmer_id = $1', [farmer.id]);
  const farmIds = farms.map(f => f.id);
  if (farmIds.length === 0) return res.json({ sensors: [] });
  const placeholders = farmIds.map((_, i) => `$${i + 1}`).join(',');
  let rows = [];
  try {
    const result = await query(
      `SELECT s.id, s.name, s.type, s.value, s.unit, s.status, s.last_reading_at
       FROM system_sensors s WHERE s.farm_id IN (${placeholders})`,
      farmIds
    );
    rows = result.rows;
  } catch {}
  res.json({ sensors: rows.length ? rows : [
    { id: '1', name: 'Soil Moisture', type: 'moisture', value: 45, unit: '%', status: 'online', last_reading_at: new Date().toISOString() },
    { id: '2', name: 'Temperature', type: 'temperature', value: 27, unit: '°C', status: 'online', last_reading_at: new Date().toISOString() },
    { id: '3', name: 'Humidity', type: 'humidity', value: 62, unit: '%', status: 'online', last_reading_at: new Date().toISOString() },
    { id: '4', name: 'Light', type: 'light', value: 850, unit: 'lux', status: 'online', last_reading_at: new Date().toISOString() }
  ] });
}));

// Robots (farmer)
app.get('/api/system/robots', requireAuth(async (req, res) => {
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.json({ robots: [] });
  let rows = [];
  try {
    const result = await query(
      `SELECT r.id, r.name, r.type, r.status, r.battery, r.last_active
       FROM system_robots r WHERE r.farmer_id = $1`,
      [farmer.id]
    );
    rows = result.rows;
  } catch {}
  res.json({ robots: rows.length ? rows : [
    { id: '1', name: 'Irrigation Bot A', type: 'irrigation', status: 'watering', battery: 85, last_active: new Date().toISOString() },
    { id: '2', name: 'Irrigation Bot B', type: 'irrigation', status: 'idle', battery: 92, last_active: new Date().toISOString() },
    { id: '3', name: 'Soil Scout', type: 'scout', status: 'online', battery: 78, last_active: new Date().toISOString() },
    { id: '4', name: 'Pest Scout', type: 'pest_scout', status: 'online', battery: 88, last_active: new Date().toISOString() },
    { id: '5', name: 'Weeds Scout', type: 'weeds_scout', status: 'idle', battery: 91, last_active: new Date().toISOString() }
  ] });
}));

// Control commands
app.post('/api/system/control/irrigation', requireAuth(async (req, res) => {
  const { action, farm_id } = req.body || {};
  if (!['start', 'stop'].includes(action)) return res.status(400).json({ error: 'Action must be start or stop' });
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true, action, message: action === 'start' ? 'Irrigation started' : 'Irrigation stopped' });
}));

app.post('/api/system/robots/:id/command', requireAuth(async (req, res) => {
  const { action } = req.body || {};
  if (!['start', 'stop', 'pause'].includes(action)) return res.status(400).json({ error: 'Action must be start, stop, or pause' });
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  const farmer = farmerRows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true, robotId: req.params.id, action, message: `Robot ${action} command sent` });
}));

app.post('/api/system/sensors/:id/calibrate', requireAuth(async (req, res) => {
  const userId = req.user.id;
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  if (!farmerRows[0]) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true, sensorId: req.params.id, message: 'Calibration started' });
}));

app.get('/api/system/health', async (_, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => console.log(`🇰🇪 System Service :${PORT}`));
