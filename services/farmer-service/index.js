import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4002;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

app.use(cors());
app.use(express.json());

function useDb(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  };
}

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

// Get current farmer's full dashboard data (requires auth)
app.get('/api/farmers/me', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const { rows: farmerRows } = await query(
    `SELECT f.id, f.name, f.phone, f.region, f.created_at
     FROM farmers f WHERE f.user_id = $1`,
    [userId]
  );
  const farmer = farmerRows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { rows: farms } = await query(
    'SELECT id, farmer_id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1',
    [farmer.id]
  );

  const farmIds = farms.map((f) => f.id);
  let crops = [];
  let tasks = [];
  if (farmIds.length > 0) {
    const placeholders = farmIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: cropRows } = await query(
      `SELECT id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status
       FROM crops WHERE farm_id IN (${placeholders})`,
      farmIds
    );
    crops = cropRows;
    const { rows: taskRows } = await query(
      `SELECT id, crop_id, farm_id, amount_mm, scheduled_time, completed
       FROM watering_tasks WHERE farm_id IN (${placeholders}) AND completed = FALSE
       ORDER BY scheduled_time LIMIT 10`,
      farmIds
    );
    tasks = taskRows;
  }

  const { rows: alertRows } = await query(
    'SELECT id, severity, message, created_at FROM alerts WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 10',
    [farmer.id]
  );

  res.json({
    farmer: { id: farmer.id, name: farmer.name, phone: farmer.phone, region: farmer.region },
    farms,
    crops,
    tasks,
    alerts: alertRows.map((a) => ({
      id: a.id,
      severity: a.severity,
      message: a.message,
      time: formatTimeAgo(a.created_at),
    })),
  });
})));

app.get('/api/farmers', useDb(async (_, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.phone, f.region, f.created_at, u.email, u.role
     FROM farmers f JOIN users u ON f.user_id = u.id`
  );
  res.json({ farmers: rows });
}));

app.get('/api/farmers/:id', useDb(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.phone, f.region, f.created_at, u.id as user_id, u.email, u.role
     FROM farmers f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
  res.json(rows[0]);
}));

app.post('/api/farmers', useDb(async (req, res) => {
  const { user_id, name, phone, region } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const { rows } = await query(
    `INSERT INTO farmers (user_id, name, phone, region) VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, phone, region, created_at`,
    [user_id, name || null, phone || null, region || null]
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/farmers/:id', useDb(async (req, res) => {
  const { name, phone, region } = req.body || {};
  const { rowCount } = await query(
    `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), region = COALESCE($3, region)
     WHERE id = $4`,
    [name, phone, region, req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true });
}));

app.delete('/api/farmers/:id', useDb(async (req, res) => {
  const { rowCount } = await query('DELETE FROM farmers WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true });
}));

app.get('/api/farmers/:id/farms', useDb(async (req, res) => {
  const { rows } = await query(
    'SELECT id, farmer_id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1',
    [req.params.id]
  );
  res.json({ farms: rows });
}));

app.get('/api/farmers/:id/crops', useDb(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.farm_id, c.name, c.swahili_name, c.planted_date, c.harvest_date, c.area_hectares, c.status
     FROM crops c JOIN farms f ON c.farm_id = f.id WHERE f.farmer_id = $1`,
    [req.params.id]
  );
  res.json({ crops: rows });
}));

app.post('/api/farmers/:id/farms', useDb(async (req, res) => {
  const { name, location, area_hectares } = req.body || {};
  const { rows } = await query(
    `INSERT INTO farms (farmer_id, name, location, area_hectares)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.params.id, name || null, location || null, area_hectares || null]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.get('/api/farmers/:id/analytics', useDb(async (_, res) => {
  res.json({ data: [] });
}));

app.get('/api/farmers/:id/alerts', useDb(async (req, res) => {
  const { rows } = await query(
    'SELECT id, severity, message, created_at FROM alerts WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ alerts: rows });
}));

app.post('/api/farmers/:id/irrigation', useDb(async (_, res) => {
  res.json({ ok: true });
}));

app.get('/api/farmers/health', async (_, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

function formatTimeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

app.listen(PORT, () => console.log(`🇰🇪 Farmer Service :${PORT}`));
