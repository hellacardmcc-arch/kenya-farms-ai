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
      console.error('[farmer-service]', err?.message || err);
      const msg = err?.message || 'Database error';
      const code = err?.code;
      if (code === '23503') return res.status(400).json({ error: 'Invalid reference (e.g. farmer not found)' });
      if (code === '23514') return res.status(400).json({ error: 'Invalid value (e.g. area must be >= 0)' });
      if (code === '23505') return res.status(400).json({ error: 'Duplicate value (e.g. farm code already exists)' });
      res.status(500).json({ error: msg });
    }
  };
}

function requireAuth(handler) {
  return (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized. Please log in again.' });
    try {
      req.user = jwt.verify(auth.slice(7), JWT_SECRET);
      return handler(req, res);
    } catch {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
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
    'INSERT INTO farmers (user_id, name, phone, location) VALUES ($1, $2, $3, $4) RETURNING id',
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
    `SELECT f.id, f.name, f.phone, f.location, f.created_at
     FROM farmers f WHERE f.id = $1`,
    [farmerRow.id]
  );
  const farmer = farmerRows[0];

  let farms;
  try {
    const r = await query(
      'SELECT id, farmer_id, name, location, area_hectares, unique_code, latitude, longitude, created_at FROM farms WHERE farmer_id = $1',
      [farmer.id]
    );
    farms = r.rows;
  } catch (e) {
    if (e.message && (e.message.includes('unique_code') || e.message.includes('latitude') || e.message.includes('longitude'))) {
      const r = await query(
        'SELECT id, farmer_id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1',
        [farmer.id]
      );
      farms = r.rows.map((row) => ({ ...row, unique_code: null, latitude: null, longitude: null }));
    } else throw e;
  }

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
    farmer: { id: farmer.id, name: farmer.name, phone: farmer.phone, location: farmer.location },
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
    `SELECT f.id, f.name, f.phone, f.location, f.created_at, u.email, u.role
     FROM farmers f JOIN users u ON f.user_id = u.id`
  );
  res.json({ farmers: rows });
}));

app.get('/api/farmers/:id', useDb(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.phone, f.location, f.created_at, u.id as user_id, u.email, u.role
     FROM farmers f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
  res.json(rows[0]);
}));

app.post('/api/farmers', useDb(async (req, res) => {
  const { user_id, name, phone, location } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const { rows } = await query(
    `INSERT INTO farmers (user_id, name, phone, location) VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, phone, location, created_at`,
    [user_id, name || null, phone || null, location || null]
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/farmers/:id', useDb(async (req, res) => {
  const { name, phone, location } = req.body || {};
  const { rowCount } = await query(
    `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), location = COALESCE($3, location)
     WHERE id = $4`,
    [name, phone, location, req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true });
}));

app.delete('/api/farmers/:id', useDb(async (req, res) => {
  const { rowCount } = await query('DELETE FROM farmers WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ok: true });
}));

// Lookup farm by unique code (global identifier) - accessible across system
app.get('/api/farms/by-code/:code', useDb(async (req, res) => {
  const code = req.params.code?.trim();
  if (!code) return res.status(400).json({ error: 'Unique code required' });
  try {
    const { rows } = await query(
      `SELECT f.id, f.farmer_id, f.name, f.location, f.area_hectares, f.unique_code, f.latitude, f.longitude, f.created_at,
              fr.name as owner_name, fr.phone as owner_phone
       FROM farms f JOIN farmers fr ON f.farmer_id = fr.id WHERE f.unique_code = $1`,
      [code]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farm not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.message && e.message.includes('unique_code')) {
      return res.status(400).json({ error: 'Run migration 009 to enable farm lookup by unique code' });
    }
    throw e;
  }
}));

app.get('/api/farmers/:id/farms', useDb(async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, farmer_id, name, location, area_hectares, unique_code, latitude, longitude, created_at FROM farms WHERE farmer_id = $1',
      [req.params.id]
    );
    return res.json({ farms: rows });
  } catch (e) {
    if (e.message && (e.message.includes('unique_code') || e.message.includes('latitude') || e.message.includes('longitude'))) {
      const { rows } = await query(
        'SELECT id, farmer_id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1',
        [req.params.id]
      );
      return res.json({ farms: rows.map((r) => ({ ...r, unique_code: null, latitude: null, longitude: null })) });
    }
    throw e;
  }
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
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found. Ensure you are registered as a farmer.' });

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body. Send JSON with name, location (optional), area_hectares (optional).' });
  }
  const name = body.name != null ? String(body.name).trim() : '';
  if (!name) return res.status(400).json({ error: 'Farm name is required' });

  const areaNum = body.area_hectares != null && !Number.isNaN(Number(body.area_hectares)) ? Number(body.area_hectares) : 0.5;
  const areaVal = areaNum >= 0 ? areaNum : 0.5;
  const locVal = body.location != null && String(body.location).trim() ? String(body.location).trim() : null;
  const latNum = body.latitude != null && !Number.isNaN(Number(body.latitude)) ? Number(body.latitude) : null;
  const lngNum = body.longitude != null && !Number.isNaN(Number(body.longitude)) ? Number(body.longitude) : null;
  const codeVal = body.unique_code != null && String(body.unique_code).trim() ? String(body.unique_code).trim() : null;

  let rows;
  try {
    const r = await query(
      `INSERT INTO farms (farmer_id, name, location, area_hectares, latitude, longitude, unique_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, farmer_id, name, location, area_hectares, unique_code, latitude, longitude, created_at`,
      [farmer.id, name, locVal, areaVal, latNum, lngNum, codeVal]
    );
    rows = r.rows;
  } catch (e) {
    if (e.message && (e.message.includes('unique_code') || e.message.includes('latitude') || e.message.includes('longitude') || e.message.includes('column'))) {
      try {
        const r = await query(
          `INSERT INTO farms (farmer_id, name, location, area_hectares)
           VALUES ($1, $2, $3, $4) RETURNING id, farmer_id, name, location, area_hectares, created_at`,
          [farmer.id, name, locVal, areaVal]
        );
        rows = r.rows.map((row) => ({ ...row, unique_code: null, latitude: null, longitude: null }));
      } catch (fallbackErr) {
        console.error('[farmer-service] create farm fallback failed:', fallbackErr?.message);
        return res.status(500).json({ error: fallbackErr?.message || 'Failed to save farm. Check database migrations.' });
      }
    } else {
      console.error('[farmer-service] create farm failed:', e?.message);
      return res.status(500).json({ error: e?.message || 'Failed to save farm to database.' });
    }
  }
  res.status(201).json(rows[0]);
})));

// Update farm for current farmer (requires auth)
app.put('/api/farmers/me/farms/:id', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { name, location, area_hectares, latitude, longitude } = req.body || {};
  const updates = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(String(name).trim()); }
  if (location !== undefined) { updates.push(`location = $${i++}`); values.push(location != null && String(location).trim() ? String(location).trim() : null); }
  if (area_hectares !== undefined) {
    const areaVal = area_hectares != null && !Number.isNaN(Number(area_hectares)) && Number(area_hectares) >= 0 ? Number(area_hectares) : null;
    updates.push(`area_hectares = $${i++}`);
    values.push(areaVal);
  }
  if (latitude !== undefined) { updates.push(`latitude = $${i++}`); values.push(latitude != null && !Number.isNaN(Number(latitude)) ? Number(latitude) : null); }
  if (longitude !== undefined) { updates.push(`longitude = $${i++}`); values.push(longitude != null && !Number.isNaN(Number(longitude)) ? Number(longitude) : null); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id, farmer.id);

  try {
    const { rows } = await query(
      `UPDATE farms SET ${updates.join(', ')} WHERE id = $${i} AND farmer_id = $${i + 1}
       RETURNING id, farmer_id, name, location, area_hectares, unique_code, latitude, longitude, created_at`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Farm not found or not yours' });
    res.json(rows[0]);
  } catch (e) {
    if (e.message && (e.message.includes('latitude') || e.message.includes('longitude') || e.message.includes('column'))) {
      const skipLatLng = (u) => !u.includes('latitude') && !u.includes('longitude');
      const simpleUpdates = updates.filter(skipLatLng);
      if (simpleUpdates.length === 0) return res.status(400).json({ error: 'No updatable fields (lat/lng not supported)' });
      const simpleValues = [];
      updates.forEach((u, idx) => { if (skipLatLng(u)) simpleValues.push(values[idx]); });
      simpleValues.push(req.params.id, farmer.id);
      const renumbered = simpleUpdates.map((u, j) => u.replace(/\$\d+/, `$${j + 1}`));
      const { rows } = await query(
        `UPDATE farms SET ${renumbered.join(', ')} WHERE id = $${simpleUpdates.length + 1} AND farmer_id = $${simpleUpdates.length + 2}
         RETURNING id, farmer_id, name, location, area_hectares, created_at`,
        simpleValues
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Farm not found' });
      res.json({ ...rows[0], unique_code: null, latitude: null, longitude: null });
    } else throw e;
  }
})));

// Delete farm for current farmer (requires auth) - cascades to crops
app.delete('/api/farmers/me/farms/:id', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { rowCount } = await query(
    'DELETE FROM farms WHERE id = $1 AND farmer_id = $2',
    [req.params.id, farmer.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Farm not found or not yours' });
  res.json({ ok: true });
})));

// Add crop for current farmer (requires auth)
app.post('/api/farmers/me/crops', requireAuth(useDb(async (req, res) => {
  const userId = req.user.id;
  const farmer = await ensureFarmer(userId);
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  const { farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status, expected_yield_kg } = req.body || {};
  if (!farm_id || !name) return res.status(400).json({ error: 'farm_id and name required' });

  const { rows: farmRows } = await query(
    'SELECT id, area_hectares FROM farms WHERE id = $1 AND farmer_id = $2',
    [farm_id, farmer.id]
  );
  if (!farmRows[0]) return res.status(403).json({ error: 'Farm not found or not yours' });

  const farmArea = Number(farmRows[0].area_hectares) || 0;
  const { rows: allocatedRows } = await query(
    'SELECT COALESCE(SUM(area_hectares), 0) AS total FROM crops WHERE farm_id = $1',
    [farm_id]
  );
  const allocated = Number(allocatedRows[0]?.total) || 0;
  const available = Math.max(0, farmArea - allocated);
  const requestedArea = area_hectares != null && !Number.isNaN(Number(area_hectares)) ? Number(area_hectares) : 0.5;
  if (requestedArea > available) {
    return res.status(400).json({
      error: `Requested area (${requestedArea} ha) exceeds available land on this farm (${available} ha). Re-allocate or register more farm.`
    });
  }

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
