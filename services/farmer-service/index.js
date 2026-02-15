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

/** Ensure farmer profile exists for user; auto-create if user has role farmer but no farmers row. */
async function ensureFarmer(userId) {
  const { rows: farmerRows } = await query('SELECT id FROM farmers WHERE user_id = $1', [userId]);
  if (farmerRows[0]) return farmerRows[0];
  const { rows: userRows } = await query('SELECT id, name, phone FROM users WHERE id = $1 AND role = $2', [userId, 'farmer']);
  if (!userRows[0]) return null;
  const u = userRows[0];
  const { rows } = await query(
    'INSERT INTO farmers (user_id, name, phone, region) VALUES ($1, $2, $3, $4) RETURNING id',
    [u.id, u.name || null, u.phone || null, null]
  );
  return rows[0];
}

// Get current farmer's full dashboard data (requires auth)
app.get('/api/farmers/me', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmerRow = await ensureFarmer(userId);
  if (!farmerRow) return res.status(404).json({ error: 'Farmer profile not found' });
  const { rows: farmerRows } = await query(
    `SELECT f.id, f.name, f.phone, f.region, f.created_at
     FROM farmers f WHERE f.id = $1`,
    [farmerRow.id]
  );
  const farmer = farmerRows[0];

  const { rows: farms } = await query(
    'SELECT id, farmer_id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1',
    [farmer.id]
  );

  const farmIds = farms.map((f) => f.id);
  let crops = [];
  let tasks = [];
  if (farmIds.length > 0) {
    const placeholders = farmIds.map((_, i) => `$${i + 1}`).join(',');
    let cropRows;
    try {
      const r = await query(
        `SELECT id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status,
                expected_yield_kg, actual_yield_kg
         FROM crops WHERE farm_id IN (${placeholders})`,
        farmIds
      );
      cropRows = r.rows;
    } catch (e) {
      if (e.message && e.message.includes('expected_yield_kg')) {
        const r = await query(
          `SELECT id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status
           FROM crops WHERE farm_id IN (${placeholders})`,
          farmIds
        );
        cropRows = r.rows.map((row) => ({ ...row, expected_yield_kg: null, actual_yield_kg: null }));
      } else throw e;
    }
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

// Create farm for current farmer (requires auth)
app.post('/api/farmers/me/farms', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { name, location, area_hectares } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Farm name required' });

  const { rows } = await query(
    `INSERT INTO farms (farmer_id, name, location, area_hectares)
     VALUES ($1, $2, $3, $4) RETURNING id, farmer_id, name, location, area_hectares, created_at`,
    [farmer.id, name.trim(), location || null, area_hectares || null]
  );
  res.status(201).json(rows[0]);
})));

// Add crop for current farmer (requires auth)
app.post('/api/farmers/me/crops', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status, expected_yield_kg } = req.body || {};
  if (!farm_id || !name) return res.status(400).json({ error: 'farm_id and name required' });

  const { rows: farmCheck } = await query(
    'SELECT id FROM farms WHERE id = $1 AND farmer_id = $2',
    [farm_id, farmer.id]
  );
  if (!farmCheck[0]) return res.status(403).json({ error: 'Farm not found or not yours' });

  let rows;
  try {
    const r = await query(
      `INSERT INTO crops (farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status, expected_yield_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status`,
      [farm_id, name, swahili_name || null, planted_date || null, harvest_date || null, area_hectares || null, status || 'growing', expected_yield_kg || null]
    );
    rows = r.rows;
  } catch (e) {
    if (e.message && e.message.includes('expected_yield_kg')) {
      const r = await query(
        `INSERT INTO crops (farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status`,
        [farm_id, name, swahili_name || null, planted_date || null, harvest_date || null, area_hectares || null, status || 'growing']
      );
      rows = r.rows;
    } else throw e;
  }
  res.status(201).json(rows[0]);
})));

// Update crop expected yield for current farmer
app.put('/api/farmers/me/crops/:id', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { expected_yield_kg, actual_yield_kg } = req.body || {};
  const updates = [];
  const values = [];
  let i = 1;
  if (expected_yield_kg !== undefined) { updates.push(`expected_yield_kg = $${i++}`); values.push(expected_yield_kg); }
  if (actual_yield_kg !== undefined) { updates.push(`actual_yield_kg = $${i++}`); values.push(actual_yield_kg); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id, farmer.id);

  try {
    const { rowCount } = await query(
      `UPDATE crops SET ${updates.join(', ')} WHERE id = $${i} AND farm_id IN (SELECT id FROM farms WHERE farmer_id = $${i + 1})`,
      values
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('expected_yield_kg') || e.message.includes('actual_yield_kg')) {
      return res.status(400).json({ error: 'Run migration 008 to add yield columns' });
    }
    throw e;
  }
})));

// Get yield records for current farmer (per farm per season)
app.get('/api/farmers/me/yields', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  try {
    const { rows } = await query(
      `SELECT cyr.id, cyr.crop_id, cyr.farm_id, cyr.season_year, cyr.season_label, cyr.harvest_date,
              cyr.actual_yield_kg, cyr.unit, cyr.notes, c.name as crop_name, c.swahili_name as crop_swahili_name,
              f.name as farm_name
       FROM crop_yield_records cyr
       JOIN crops c ON cyr.crop_id = c.id
       JOIN farms f ON cyr.farm_id = f.id
       WHERE f.farmer_id = $1
       ORDER BY cyr.season_year DESC, cyr.harvest_date DESC`,
      [farmer.id]
    );
    res.json({ yields: rows });
  } catch (e) {
    if (e.message && e.message.includes('crop_yield_records')) {
      return res.json({ yields: [] });
    }
    throw e;
  }
})));

// Add yield record for current farmer
app.post('/api/farmers/me/yields', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { crop_id, farm_id, season_year, season_label, harvest_date, actual_yield_kg, unit, notes } = req.body || {};
  if (!crop_id || !farm_id || actual_yield_kg == null) return res.status(400).json({ error: 'crop_id, farm_id, and actual_yield_kg required' });

  const { rows: farmCheck } = await query(
    'SELECT id FROM farms WHERE id = $1 AND farmer_id = $2',
    [farm_id, farmer.id]
  );
  if (!farmCheck[0]) return res.status(403).json({ error: 'Farm not found or not yours' });

  const { rows: cropCheck } = await query(
    'SELECT id FROM crops WHERE id = $1 AND farm_id = $2',
    [crop_id, farm_id]
  );
  if (!cropCheck[0]) return res.status(403).json({ error: 'Crop not found or not in this farm' });

  try {
    const { rows } = await query(
      `INSERT INTO crop_yield_records (crop_id, farm_id, season_year, season_label, harvest_date, actual_yield_kg, unit, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, crop_id, farm_id, season_year, season_label, harvest_date, actual_yield_kg, unit`,
      [crop_id, farm_id, season_year || new Date().getFullYear(), season_label || null, harvest_date || null, actual_yield_kg, unit || 'kg', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.message && e.message.includes('crop_yield_records')) {
      return res.status(400).json({ error: 'Run migration 008 to add yield records table' });
    }
    throw e;
  }
})));

// Delete crop for current farmer (soft delete if supported)
app.delete('/api/farmers/me/crops/:id', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  try {
    const { rowCount } = await query(
      `UPDATE crops SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL
       AND farm_id IN (SELECT id FROM farms WHERE farmer_id = $2)`,
      [req.params.id, farmer.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rowCount } = await query(
        `DELETE FROM crops WHERE id = $1 AND farm_id IN (SELECT id FROM farms WHERE farmer_id = $2)`,
        [req.params.id, farmer.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
      res.json({ ok: true });
    } else throw e;
  }
})));

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
