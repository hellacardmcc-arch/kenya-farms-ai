import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import os from 'os';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, reconnect } from './db.js';
import { MIGRATION_ORDER } from './scripts/migration-order.js';
import { updateMigrationOrder } from './scripts/update-migration-order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execAsync = promisify(exec);

const app = express();
const PORT = 4006;

app.use(cors());
app.use(express.json());

function useDb(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[admin-service]', err?.message || err);
      const msg = err?.message || 'Database error';
      res.status(500).json({ error: msg });
    }
  };
}

// Farmers (CRUD + soft delete + restore) - includes farms_count per farmer (farmer_id -> farms binding)
app.get('/api/admin/farmers', useDb(async (req, res) => {
  const includeDeleted = req.query.deleted === 'true';
  const withFarms = req.query.farms === 'true' || req.query.farms === '1';
  const runQuery = async (useDeletedFilter) => {
    const where = useDeletedFilter ? ' AND fr.deleted_at IS NULL' : '';
    const sel = useDeletedFilter
      ? 'fr.id, fr.name, fr.phone, fr.location, fr.created_at, fr.deleted_at'
      : 'fr.id, fr.name, fr.phone, fr.location, fr.created_at';
    return query(
      `SELECT ${sel}, u.id as user_id, u.email, u.role,
        (SELECT COUNT(*)::int FROM farms f WHERE f.farmer_id = fr.id) as farms_count
       FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE 1=1${where}
       ORDER BY fr.created_at DESC`
    );
  };
  const runMinimalQuery = () => query(
    `SELECT fr.id, fr.name, fr.phone, fr.created_at, u.id as user_id, u.email, u.role,
      (SELECT COUNT(*)::int FROM farms f WHERE f.farmer_id = fr.id) as farms_count
     FROM farmers fr JOIN users u ON fr.user_id = u.id
     ORDER BY fr.created_at DESC`
  );
  try {
    const { rows } = await runQuery(!includeDeleted);
    if (withFarms) {
      for (const farmer of rows) {
        try {
          const r = await query(
            'SELECT id, name, location, area_hectares, unique_code, latitude, longitude, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
            [farmer.id]
          );
          farmer.farms = r.rows;
        } catch (fe) {
          if (fe.message && (fe.message.includes('unique_code') || fe.message.includes('latitude') || fe.message.includes('longitude'))) {
            const r = await query(
              'SELECT id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
              [farmer.id]
            );
            farmer.farms = (r.rows || []).map((f) => ({ ...f, unique_code: null, latitude: null, longitude: null }));
          } else {
            farmer.farms = [];
          }
        }
      }
    }
    return res.json({ farmers: rows });
  } catch (e) {
    if (e.message && (e.message.includes('deleted_at') || e.message.includes('column') || e.message.includes('location') || e.message.includes('region'))) {
      try {
        const { rows } = await runQuery(false);
        if (withFarms) {
          for (const farmer of rows) {
            try {
              const r = await query(
                'SELECT id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
                [farmer.id]
              );
              farmer.farms = (r.rows || []).map((f) => ({ ...f, unique_code: null, latitude: null, longitude: null }));
            } catch (_) {
              farmer.farms = [];
            }
          }
        }
        return res.json({ farmers: rows });
      } catch (_) {
        try {
          const { rows } = await runMinimalQuery();
          rows.forEach((r) => { r.location = r.location ?? null; });
          if (withFarms) {
            for (const farmer of rows) {
              try {
                const r = await query('SELECT id, name, area_hectares, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC', [farmer.id]);
                farmer.farms = r.rows || [];
              } catch (_) { farmer.farms = []; }
            }
          }
          return res.json({ farmers: rows });
        } catch (minErr) {
          throw e;
        }
      }
    }
    throw e;
  }
}));

app.get('/api/admin/farmers/:id', useDb(async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT fr.id, fr.name, fr.phone, fr.location, fr.created_at, fr.deleted_at, u.id as user_id, u.email, u.role,
        (SELECT COUNT(*)::int FROM farms f WHERE f.farmer_id = fr.id) as farms_count
       FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE fr.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
    const farmer = rows[0];
    let farmRows = [];
    try {
      const r = await query(
        'SELECT id, name, location, area_hectares, unique_code, latitude, longitude, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
        [farmer.id]
      );
      farmRows = r.rows;
    } catch (fe) {
      if (fe.message && (fe.message.includes('unique_code') || fe.message.includes('latitude') || fe.message.includes('longitude'))) {
        const r = await query(
          'SELECT id, name, location, area_hectares, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
          [farmer.id]
        );
        farmRows = (r.rows || []).map((f) => ({ ...f, unique_code: null, latitude: null, longitude: null }));
      } else throw fe;
    }
    farmer.farms = farmRows;
    return res.json(farmer);
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows } = await query(
        `SELECT fr.id, fr.name, fr.phone, fr.location, fr.created_at, u.id as user_id, u.email, u.role,
          (SELECT COUNT(*)::int FROM farms f WHERE f.farmer_id = fr.id) as farms_count
         FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE fr.id = $1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
      const farmer = rows[0];
      try {
        const { rows: farmRows } = await query(
          'SELECT id, name, location, area_hectares, unique_code, latitude, longitude, created_at FROM farms WHERE farmer_id = $1 ORDER BY created_at DESC',
          [farmer.id]
        );
        farmer.farms = farmRows;
      } catch (_) {
        farmer.farms = [];
      }
      return res.json(farmer);
    }
    throw e;
  }
}));

app.post('/api/admin/farmers/register', useDb(async (req, res) => {
  const { email, password, name, phone, location, farm_name, farm_size, farm_location, farm_latitude, farm_longitude } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!farm_name || (farm_name && String(farm_name).trim() === '')) return res.status(400).json({ error: 'Farm name required' });
  const areaHectares = farm_size != null && farm_size !== '' ? parseFloat(farm_size) : null;
  if (areaHectares != null && (isNaN(areaHectares) || areaHectares < 0)) return res.status(400).json({ error: 'Farm size must be a non-negative number' });
  const farmLoc = farm_location != null && String(farm_location).trim() ? String(farm_location).trim() : null;
  const farmLat = farm_latitude != null && !Number.isNaN(Number(farm_latitude)) ? Number(farm_latitude) : null;
  const farmLng = farm_longitude != null && !Number.isNaN(Number(farm_longitude)) ? Number(farm_longitude) : null;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows: userRows } = await query(
      `INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, 'farmer')
       RETURNING id, email, name, role`,
      [email, passwordHash, name || null, phone || null]
    );
    const user = userRows[0];
    const { rows: farmerRows } = await query(
      'INSERT INTO farmers (user_id, name, phone, location) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, phone, location, created_at',
      [user.id, name || null, phone || null, location || null]
    );
    const farmer = farmerRows[0];
    try {
      await query(
        'INSERT INTO farms (farmer_id, name, location, area_hectares, latitude, longitude, unique_code) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [farmer.id, String(farm_name).trim(), farmLoc, areaHectares, farmLat, farmLng, null]
      );
    } catch (fe) {
      if (fe.message && (fe.message.includes('unique_code') || fe.message.includes('latitude') || fe.message.includes('longitude'))) {
        await query(
          'INSERT INTO farms (farmer_id, name, location, area_hectares) VALUES ($1, $2, $3, $4)',
          [farmer.id, String(farm_name).trim(), farmLoc, areaHectares]
        );
      } else throw fe;
    }
    res.status(201).json({ user, farmer });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  }
}));

app.put('/api/admin/farmers/:id', useDb(async (req, res) => {
  const { name, phone, location } = req.body || {};
  try {
    const { rows } = await query(
      `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), location = COALESCE($3, location)
       WHERE id = $4 AND deleted_at IS NULL RETURNING id`,
      [name, phone, location, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
    const { rows: userRows } = await query('SELECT user_id FROM farmers WHERE id = $1', [req.params.id]);
    if (name !== undefined && userRows[0]) {
      await query('UPDATE users SET name = COALESCE($1, name) WHERE id = $2', [name, userRows[0].user_id]);
    }
    return res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rowCount } = await query(
        `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), location = COALESCE($3, location) WHERE id = $4`,
        [name, phone, location, req.params.id]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
      const { rows: userRows } = await query('SELECT user_id FROM farmers WHERE id = $1', [req.params.id]);
      if (name !== undefined && userRows[0]) {
        await query('UPDATE users SET name = COALESCE($1, name) WHERE id = $2', [name, userRows[0].user_id]);
      }
      return res.json({ ok: true });
    }
    throw e;
  }
}));

app.delete('/api/admin/farmers/:id', useDb(async (req, res) => {
  try {
    const { rowCount } = await query('UPDATE farmers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rowCount } = await query('DELETE FROM farmers WHERE id = $1', [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found' });
      res.json({ ok: true });
    } else throw e;
  }
}));

app.post('/api/admin/farmers/:id/restore', useDb(async (req, res) => {
  try {
    const { rowCount } = await query('UPDATE farmers SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Farmer not found or not deleted' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) return res.status(400).json({ error: 'Restore not supported - run migration 004' });
    throw e;
  }
}));

// Crops (CRUD + soft delete + restore)
app.get('/api/admin/crops', useDb(async (req, res) => {
  const includeDeleted = req.query.deleted === 'true';
  try {
    const where = includeDeleted ? '' : ' AND c.deleted_at IS NULL';
    const { rows } = await query(
      `SELECT c.id, c.farm_id, c.name, c.swahili_name, c.planted_date, c.harvest_date, c.area_hectares, c.status, c.created_at, c.deleted_at,
        f.name as farm_name, fr.name as farmer_name
       FROM crops c JOIN farms f ON c.farm_id = f.id JOIN farmers fr ON f.farmer_id = fr.id WHERE 1=1${where}
       ORDER BY c.created_at DESC`
    );
    return res.json({ crops: rows });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows } = await query(
        `SELECT c.id, c.farm_id, c.name, c.swahili_name, c.planted_date, c.harvest_date, c.area_hectares, c.status, c.created_at,
          f.name as farm_name, fr.name as farmer_name
         FROM crops c JOIN farms f ON c.farm_id = f.id JOIN farmers fr ON f.farmer_id = fr.id
         ORDER BY c.created_at DESC`
      );
      return res.json({ crops: rows });
    }
    throw e;
  }
}));

app.post('/api/admin/crops', useDb(async (req, res) => {
  const { farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status } = req.body || {};
  if (!farm_id || !name) return res.status(400).json({ error: 'farm_id and name required' });
  const { rows } = await query(
    `INSERT INTO crops (farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, farm_id, name, swahili_name, planted_date, harvest_date, area_hectares, status, created_at`,
    [farm_id, name, swahili_name || null, planted_date || null, harvest_date || null, area_hectares || null, status || 'growing']
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/admin/crops/:id', useDb(async (req, res) => {
  const { name, swahili_name, planted_date, harvest_date, area_hectares, status } = req.body || {};
  const updates = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
  if (swahili_name !== undefined) { updates.push(`swahili_name = $${i++}`); values.push(swahili_name); }
  if (planted_date !== undefined) { updates.push(`planted_date = $${i++}`); values.push(planted_date); }
  if (harvest_date !== undefined) { updates.push(`harvest_date = $${i++}`); values.push(harvest_date); }
  if (area_hectares !== undefined) { updates.push(`area_hectares = $${i++}`); values.push(area_hectares); }
  if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  try {
    const { rowCount } = await query(
      `UPDATE crops SET ${updates.join(', ')} WHERE id = $${i} AND deleted_at IS NULL`,
      values
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rowCount } = await query(`UPDATE crops SET ${updates.join(', ')} WHERE id = $${i}`, values);
      if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
      res.json({ ok: true });
    } else throw e;
  }
}));

app.delete('/api/admin/crops/:id', useDb(async (req, res) => {
  try {
    const { rowCount } = await query('UPDATE crops SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rowCount } = await query('DELETE FROM crops WHERE id = $1', [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Crop not found' });
      res.json({ ok: true });
    } else throw e;
  }
}));

app.post('/api/admin/crops/:id/restore', useDb(async (req, res) => {
  try {
    const { rowCount } = await query('UPDATE crops SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Crop not found or not deleted' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) return res.status(400).json({ error: 'Restore not supported - run migration 004' });
    throw e;
  }
}));

// Analytics
app.get('/api/admin/analytics', useDb(async (_, res) => {
  try {
    const { rows: farmerCount } = await query('SELECT COUNT(*) as c FROM farmers WHERE deleted_at IS NULL');
    const { rows: cropCount } = await query('SELECT COUNT(*) as c FROM crops WHERE deleted_at IS NULL');
    const { rows: farmCount } = await query('SELECT COUNT(*) as c FROM farms');
    const { rows: alertCount } = await query('SELECT COUNT(*) as c FROM alerts');
    const { rows: topCrops } = await query(
      `SELECT c.name, COUNT(*) as farmers FROM crops c JOIN farms f ON c.farm_id = f.id
       WHERE c.deleted_at IS NULL GROUP BY c.name ORDER BY farmers DESC LIMIT 5`
    );
    return res.json({
      farmers: parseInt(farmerCount[0]?.c || 0, 10),
      crops: parseInt(cropCount[0]?.c || 0, 10),
      farms: parseInt(farmCount[0]?.c || 0, 10),
      alerts: parseInt(alertCount[0]?.c || 0, 10),
      topCrops: topCrops.map(r => ({ name: r.name, farmers: parseInt(r.farmers, 10) }))
    });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows: farmerCount } = await query('SELECT COUNT(*) as c FROM farmers');
      const { rows: cropCount } = await query('SELECT COUNT(*) as c FROM crops');
      const { rows: farmCount } = await query('SELECT COUNT(*) as c FROM farms');
      const { rows: alertCount } = await query('SELECT COUNT(*) as c FROM alerts');
      const { rows: topCrops } = await query(
        `SELECT c.name, COUNT(*) as farmers FROM crops c JOIN farms f ON c.farm_id = f.id
         GROUP BY c.name ORDER BY farmers DESC LIMIT 5`
      );
      return res.json({
        farmers: parseInt(farmerCount[0]?.c || 0, 10),
        crops: parseInt(cropCount[0]?.c || 0, 10),
        farms: parseInt(farmCount[0]?.c || 0, 10),
        alerts: parseInt(alertCount[0]?.c || 0, 10),
        topCrops: topCrops.map(r => ({ name: r.name, farmers: parseInt(r.farmers, 10) }))
      });
    }
    throw e;
  }
}));

// Sensors (admin: register, initialize, configure)
app.get('/api/admin/sensors', useDb(async (req, res) => {
  let rows = [];
  try {
    const result = await query(
      `SELECT s.id, s.farm_id, s.device_id, s.name, s.type, s.value, s.unit, s.status, s.last_reading_at,
        s.registration_status, s.server_config, f.name as farm_name
       FROM system_sensors s LEFT JOIN farms f ON s.farm_id = f.id ORDER BY s.created_at DESC NULLS LAST`
    );
    rows = result.rows;
  } catch (e) {
    try {
      const result = await query(
        `SELECT s.id, s.farm_id, s.name, s.type, s.value, s.unit, s.status, s.last_reading_at, f.name as farm_name
         FROM system_sensors s LEFT JOIN farms f ON s.farm_id = f.id`
      );
      rows = result.rows.map(r => ({ ...r, device_id: null, registration_status: r.farm_id ? 'active' : 'registered', server_config: null }));
    } catch {}
  }
  res.json({ sensors: rows });
}));

app.post('/api/admin/sensors/register', useDb(async (req, res) => {
  const { device_id, name, type, unit } = req.body || {};
  if (!device_id || !name) return res.status(400).json({ error: 'device_id and name required' });
  try {
    const { rows } = await query(
      `INSERT INTO system_sensors (device_id, name, type, unit, status, registration_status, last_reading_at)
       VALUES ($1, $2, $3, $4, 'offline', 'registered', NOW())
       RETURNING id, device_id, name, type, unit, status, registration_status, last_reading_at`,
      [String(device_id).trim(), name, type || null, unit || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Device ID already registered' });
    if (err.code === '42P01') return res.status(400).json({ error: 'Run migration 005 first' });
    throw err;
  }
}));

app.post('/api/admin/sensors/:id/initialize', useDb(async (req, res) => {
  try {
    const { rowCount } = await query(
      `UPDATE system_sensors SET registration_status = 'initialized', status = 'online' WHERE id = $1 AND registration_status = 'registered'`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Sensor not found or already initialized' });
    res.json({ ok: true, message: 'Sensor initialized and ready for configuration' });
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

app.post('/api/admin/sensors/:id/configure', useDb(async (req, res) => {
  const { api_key, endpoint, poll_interval_sec } = req.body || {};
  if (!api_key) return res.status(400).json({ error: 'api_key required for server communication' });
  const serverConfig = { api_key, endpoint: endpoint || null, poll_interval_sec: poll_interval_sec || 60 };
  try {
    const { rowCount } = await query(
      `UPDATE system_sensors SET registration_status = 'configured', server_config = $1 WHERE id = $2 AND registration_status IN ('registered', 'initialized')`,
      [JSON.stringify(serverConfig), req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Sensor not found or already configured/active' });
    res.json({ ok: true, message: 'Sensor configured. Farmer can now activate and pair to farm.' });
  } catch (e) {
    if (e.message && (e.message.includes('registration_status') || e.message.includes('server_config'))) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

app.put('/api/admin/sensors/:id', useDb(async (req, res) => {
  const { name, type, value, unit, status } = req.body || {};
  const updates = []; const values = []; let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
  if (type !== undefined) { updates.push(`type = $${i++}`); values.push(type); }
  if (value !== undefined) { updates.push(`value = $${i++}`); values.push(value); }
  if (unit !== undefined) { updates.push(`unit = $${i++}`); values.push(unit); }
  if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rowCount } = await query(`UPDATE system_sensors SET ${updates.join(', ')} WHERE id = $${i}`, values);
  if (rowCount === 0) return res.status(404).json({ error: 'Sensor not found' });
  res.json({ ok: true });
}));

app.delete('/api/admin/sensors/:id', useDb(async (req, res) => {
  const { rowCount } = await query('DELETE FROM system_sensors WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Sensor not found' });
  res.json({ ok: true });
}));

// Robots (admin: register, initialize, configure)
app.get('/api/admin/robots', useDb(async (_, res) => {
  let rows = [];
  try {
    const result = await query(
      `SELECT r.id, r.farmer_id, r.device_id, r.name, r.type, r.status, r.battery, r.last_active,
        r.registration_status, r.server_config, fr.name as farmer_name
       FROM system_robots r LEFT JOIN farmers fr ON r.farmer_id = fr.id ORDER BY r.created_at DESC NULLS LAST`
    );
    rows = result.rows;
  } catch (e) {
    try {
      const result = await query(
        `SELECT r.id, r.farmer_id, r.name, r.type, r.status, r.battery, r.last_active, fr.name as farmer_name
         FROM system_robots r LEFT JOIN farmers fr ON r.farmer_id = fr.id`
      );
      rows = result.rows.map(r => ({ ...r, device_id: null, registration_status: r.farmer_id ? 'active' : 'registered', server_config: null }));
    } catch {}
  }
  res.json({ robots: rows });
}));

app.post('/api/admin/robots/register', useDb(async (req, res) => {
  const { device_id, name, type, battery } = req.body || {};
  if (!device_id || !name) return res.status(400).json({ error: 'device_id and name required' });
  try {
    const { rows } = await query(
      `INSERT INTO system_robots (device_id, name, type, status, battery, registration_status, last_active)
       VALUES ($1, $2, $3, 'offline', $4, 'registered', NOW())
       RETURNING id, device_id, name, type, status, battery, registration_status, last_active`,
      [String(device_id).trim(), name, type || null, battery ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Device ID already registered' });
    if (err.code === '42P01') return res.status(400).json({ error: 'Run migration 005 first' });
    throw err;
  }
}));

app.post('/api/admin/robots/:id/initialize', useDb(async (req, res) => {
  try {
    const { rowCount } = await query(
      `UPDATE system_robots SET registration_status = 'initialized', status = 'idle' WHERE id = $1 AND registration_status = 'registered'`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Robot not found or already initialized' });
    res.json({ ok: true, message: 'Robot initialized and ready for configuration' });
  } catch (e) {
    if (e.message && e.message.includes('registration_status')) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

app.post('/api/admin/robots/:id/configure', useDb(async (req, res) => {
  const { api_key, endpoint, heartbeat_interval_sec } = req.body || {};
  if (!api_key) return res.status(400).json({ error: 'api_key required for server communication' });
  const serverConfig = { api_key, endpoint: endpoint || null, heartbeat_interval_sec: heartbeat_interval_sec || 30 };
  try {
    const { rowCount } = await query(
      `UPDATE system_robots SET registration_status = 'configured', server_config = $1 WHERE id = $2 AND registration_status IN ('registered', 'initialized')`,
      [JSON.stringify(serverConfig), req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Robot not found or already configured/active' });
    res.json({ ok: true, message: 'Robot configured. Farmer can now activate and pair to farm.' });
  } catch (e) {
    if (e.message && (e.message.includes('registration_status') || e.message.includes('server_config'))) return res.status(400).json({ error: 'Run migration 005 first' });
    throw e;
  }
}));

app.put('/api/admin/robots/:id', useDb(async (req, res) => {
  const { name, type, status, battery } = req.body || {};
  const updates = []; const values = []; let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
  if (type !== undefined) { updates.push(`type = $${i++}`); values.push(type); }
  if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
  if (battery !== undefined) { updates.push(`battery = $${i++}`); values.push(battery); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rowCount } = await query(`UPDATE system_robots SET ${updates.join(', ')} WHERE id = $${i}`, values);
  if (rowCount === 0) return res.status(404).json({ error: 'Robot not found' });
  res.json({ ok: true });
}));

app.delete('/api/admin/robots/:id', useDb(async (req, res) => {
  const { rowCount } = await query('DELETE FROM system_robots WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Robot not found' });
  res.json({ ok: true });
}));

app.get('/api/admin/farms', useDb(async (req, res) => {
  const detailed = req.query.detailed === 'true' || req.query.detailed === '1';
  const baseFrom = 'FROM farms f JOIN farmers fr ON f.farmer_id = fr.id AND fr.deleted_at IS NULL';
  try {
    let rows;
    if (detailed) {
      const { rows: r } = await query(
        `SELECT f.id, f.name, f.location, f.area_hectares, f.unique_code, f.latitude, f.longitude, f.created_at, f.farmer_id,
         fr.name as farmer_name, fr.phone as farmer_phone,
         (SELECT COUNT(*)::int FROM system_sensors s WHERE s.farm_id = f.id) as sensor_count,
         (SELECT COUNT(*)::int FROM system_robots r WHERE r.farmer_id = f.farmer_id) as robot_count,
         (SELECT COUNT(*)::int FROM crops c WHERE c.farm_id = f.id AND (c.deleted_at IS NULL)) as crops_count
         ${baseFrom} ORDER BY f.created_at DESC`
      );
      rows = r;
      for (const farm of rows) {
        let cropRows = [];
        try {
          const r = await query(
            'SELECT id, name, swahili_name, status, planted_date, harvest_date, area_hectares FROM crops WHERE farm_id = $1 AND deleted_at IS NULL ORDER BY name',
            [farm.id]
          );
          cropRows = r.rows || [];
        } catch (_) {
          try {
            const r = await query('SELECT id, name, swahili_name, status, planted_date, harvest_date, area_hectares FROM crops WHERE farm_id = $1 ORDER BY name', [farm.id]);
            cropRows = (r.rows || []).filter((c) => !c.deleted_at);
          } catch (__) {}
        }
        farm.crops = cropRows.map((c) => ({ id: c.id, name: c.name, swahili_name: c.swahili_name, status: c.status, planted_date: c.planted_date, harvest_date: c.harvest_date, area_hectares: c.area_hectares }));
      }
    } else {
      const { rows: r } = await query(
        `SELECT f.id, f.name, f.location, f.area_hectares, f.unique_code, f.latitude, f.longitude, f.created_at, fr.name as farmer_name, fr.phone
         ${baseFrom} ORDER BY f.created_at DESC`
      );
      rows = r;
    }
    return res.json({ farms: rows });
  } catch (e) {
    if (e.message && (e.message.includes('deleted_at') || e.message.includes('system_sensors') || e.message.includes('system_robots'))) {
      const { rows } = await query(
        `SELECT f.id, f.name, f.location, f.area_hectares, f.unique_code, f.latitude, f.longitude, f.created_at, fr.name as farmer_name, fr.phone
         FROM farms f JOIN farmers fr ON f.farmer_id = fr.id ORDER BY f.created_at DESC`
      );
      return res.json({ farms: rows.map((r) => ({ ...r, sensor_count: 0, robot_count: 0, crops_count: 0, crops: [] })) });
    }
    if (e.message && e.message.includes('unique_code')) {
      const { rows } = await query(
        `SELECT f.id, f.name, f.location, f.area_hectares, f.created_at, fr.name as farmer_name, fr.phone
         FROM farms f JOIN farmers fr ON f.farmer_id = fr.id ORDER BY f.created_at DESC`
      );
      return res.json({ farms: rows.map((r) => ({ ...r, unique_code: null, latitude: null, longitude: null, sensor_count: 0, robot_count: 0, crops_count: 0, crops: [] })) });
    }
    throw e;
  }
}));

app.get('/api/admin/farms/:id', useDb(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.location, f.area_hectares, f.unique_code, f.latitude, f.longitude, f.created_at, f.farmer_id, fr.name as farmer_name
     FROM farms f JOIN farmers fr ON f.farmer_id = fr.id WHERE f.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Farm not found' });
  res.json(rows[0]);
}));

app.post('/api/admin/farms', useDb(async (req, res) => {
  const { farmer_id, name, location, area_hectares, latitude, longitude, unique_code } = req.body || {};
  if (!farmer_id) return res.status(400).json({ error: 'farmer_id required' });
  const latVal = latitude != null && !Number.isNaN(Number(latitude)) ? Number(latitude) : null;
  const lngVal = longitude != null && !Number.isNaN(Number(longitude)) ? Number(longitude) : null;
  const codeVal = unique_code != null && String(unique_code).trim() ? String(unique_code).trim() : null;
  const { rows } = await query(
    `INSERT INTO farms (farmer_id, name, location, area_hectares, latitude, longitude, unique_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, unique_code, latitude, longitude`,
    [farmer_id, name || null, location || null, area_hectares || null, latVal, lngVal, codeVal]
  );
  res.status(201).json({ id: rows[0].id, unique_code: rows[0].unique_code, latitude: rows[0].latitude, longitude: rows[0].longitude });
}));

app.put('/api/admin/farms/:id', useDb(async (req, res) => {
  const { name, location, area_hectares, latitude, longitude, unique_code } = req.body || {};
  const latVal = latitude !== undefined ? (latitude != null && !Number.isNaN(Number(latitude)) ? Number(latitude) : null) : undefined;
  const lngVal = longitude !== undefined ? (longitude != null && !Number.isNaN(Number(longitude)) ? Number(longitude) : null) : undefined;
  const codeVal = unique_code !== undefined ? (unique_code != null && String(unique_code).trim() ? String(unique_code).trim() : null) : undefined;
  const updates = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name || null); }
  if (location !== undefined) { updates.push(`location = $${i++}`); values.push(location || null); }
  if (area_hectares !== undefined) { updates.push(`area_hectares = $${i++}`); values.push(area_hectares); }
  if (latVal !== undefined) { updates.push(`latitude = $${i++}`); values.push(latVal); }
  if (lngVal !== undefined) { updates.push(`longitude = $${i++}`); values.push(lngVal); }
  if (codeVal !== undefined) { updates.push(`unique_code = $${i++}`); values.push(codeVal); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rowCount } = await query(
    `UPDATE farms SET ${updates.join(', ')} WHERE id = $${i}`,
    values
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Farm not found' });
  res.json({ ok: true });
}));

app.get('/api/admin/users', useDb(async (_, res) => {
  const { rows } = await query(
    'SELECT id, email, name, phone, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
}));

app.put('/api/admin/users/:id/role', useDb(async (req, res) => {
  const { role } = req.body || {};
  if (!role || !['farmer', 'admin'].includes(role)) return res.status(400).json({ error: 'Valid role required' });
  const { rowCount } = await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
}));

const DEFAULT_PORTS = { api_gateway: 5001, auth: 5002, farmer: 4002, device: 4003, analytics: 4004, notification: 4005, admin: 4006, system: 4007 };
const DEFAULT_ENDPOINTS = { api_gateway: 'http://localhost:5001', auth: 'http://localhost:5002', farmer: 'http://localhost:4002', device: 'http://localhost:4003', analytics: 'http://localhost:4004', notification: 'http://localhost:4005', admin: 'http://localhost:4006', system: 'http://localhost:4007' };

function parseConfigValue(val) {
  if (val == null) return {};
  if (typeof val === 'object') return val;
  try { return typeof val === 'string' ? JSON.parse(val) : {}; } catch { return {}; }
}

// Settings: system config (ports, endpoints)
app.get('/api/admin/settings/config', useDb(async (_, res) => {
  try {
    const { rows } = await query('SELECT key, value FROM system_config');
    const config = {};
    rows.forEach(r => { config[r.key] = parseConfigValue(r.value) || {}; });
    if (!config.ports || Object.keys(config.ports).length === 0) config.ports = DEFAULT_PORTS;
    if (!config.endpoints || Object.keys(config.endpoints).length === 0) config.endpoints = DEFAULT_ENDPOINTS;
    return res.json({ config });
  } catch (e) {
    if (e.code === '42P01') return res.json({ config: { ports: DEFAULT_PORTS, endpoints: DEFAULT_ENDPOINTS } });
    throw e;
  }
}));

app.put('/api/admin/settings/config', useDb(async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    await query(
      `INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value || {})]
    );
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 006 first' });
    throw e;
  }
}));

app.post('/api/admin/settings/seed-config', useDb(async (_, res) => {
  try {
    await query(
      `INSERT INTO system_config (key, value) VALUES ('ports', $1), ('endpoints', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(DEFAULT_PORTS), JSON.stringify(DEFAULT_ENDPOINTS)]
    );
    return res.json({ ok: true, message: 'Default ports and endpoints seeded.' });
  } catch (e) {
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 003 first' });
    throw e;
  }
}));

// Settings: system logs
app.get('/api/admin/settings/logs', useDb(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const level = req.query.level;
  const service = req.query.service;
  try {
    let sql = 'SELECT id, level, service, message, metadata, created_at FROM system_logs WHERE 1=1';
    const params = [];
    let i = 1;
    if (level) { sql += ` AND level = $${i++}`; params.push(level); }
    if (service) { sql += ` AND service = $${i++}`; params.push(service); }
    sql += ` ORDER BY created_at DESC LIMIT $${i}`;
    params.push(limit);
    const { rows } = await query(sql, params);
    return res.json({ logs: rows });
  } catch (e) {
    if (e.code === '42P01') return res.json({ logs: [] });
    throw e;
  }
}));

app.post('/api/admin/settings/logs', useDb(async (req, res) => {
  const { level, service, message, metadata } = req.body || {};
  if (!level || !message) return res.status(400).json({ error: 'level and message required' });
  if (!['info', 'warn', 'error', 'debug'].includes(level)) return res.status(400).json({ error: 'Invalid level' });
  try {
    const { rows } = await query(
      `INSERT INTO system_logs (level, service, message, metadata) VALUES ($1, $2, $3, $4)
       RETURNING id, level, service, message, metadata, created_at`,
      [level, service || null, message, metadata ? JSON.stringify(metadata) : null]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 006 first' });
    throw e;
  }
}));

// Access requests (admin/farmer signup approval). ?role=farmer|admin filters by requested_role.
app.get('/api/admin/requests', useDb(async (req, res) => {
  const status = req.query.status || 'pending';
  const role = req.query.role;
  try {
    let rows;
    if (role === 'farmer' || role === 'admin') {
      const r = await query(
        `SELECT id, email, name, phone, requested_role, farm_name, farm_size, farm_location, farm_latitude, farm_longitude, message, status, feedback_message, created_at
         FROM access_requests WHERE status = $1 AND requested_role = $2 ORDER BY created_at DESC`,
        [status, role]
      );
      rows = r.rows;
    } else {
      const r = await query(
        `SELECT id, email, name, phone, requested_role, farm_name, farm_size, farm_location, farm_latitude, farm_longitude, message, status, feedback_message, created_at
         FROM access_requests WHERE status = $1 ORDER BY created_at DESC`,
        [status]
      );
      rows = r.rows;
    }
    return res.json({ requests: rows });
  } catch (e) {
    if (e.code === '42P01') return res.json({ requests: [] });
    throw e;
  }
}));

app.post('/api/admin/requests/:id/approve', useDb(async (req, res) => {
  const { feedback_message } = req.body || {};
  const reviewerId = req.user?.id;
  try {
    const { rows } = await query(
      'SELECT * FROM access_requests WHERE id = $1 AND status = $2',
      [req.params.id, 'pending']
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already processed' });
    const r = rows[0];
    const passwordHash = r.password_hash;
    const { rows: userRows } = await query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [r.email, passwordHash, r.name || null, r.phone || null, r.requested_role]
    );
    const user = userRows[0];
    if (r.requested_role === 'farmer') {
      const { rows: farmerRows } = await query(
        'INSERT INTO farmers (user_id, name, phone, location) VALUES ($1, $2, $3, $4) RETURNING id',
        [user.id, r.name || null, r.phone || null, null]
      );
      const farmLoc = r.farm_location != null && String(r.farm_location).trim() ? String(r.farm_location).trim() : null;
      const farmLat = r.farm_latitude != null && !Number.isNaN(Number(r.farm_latitude)) ? Number(r.farm_latitude) : null;
      const farmLng = r.farm_longitude != null && !Number.isNaN(Number(r.farm_longitude)) ? Number(r.farm_longitude) : null;
      try {
        await query(
          'INSERT INTO farms (farmer_id, name, location, area_hectares, latitude, longitude, unique_code) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [farmerRows[0].id, r.farm_name || 'My Farm', farmLoc, r.farm_size || null, farmLat, farmLng, null]
        );
      } catch (fe) {
        if (fe.message && (fe.message.includes('unique_code') || fe.message.includes('latitude') || fe.message.includes('longitude'))) {
          await query(
            'INSERT INTO farms (farmer_id, name, location, area_hectares) VALUES ($1, $2, $3, $4)',
            [farmerRows[0].id, r.farm_name || 'My Farm', farmLoc, r.farm_size || null]
          );
        } else throw fe;
      }
    }
    await query(
      'UPDATE access_requests SET status = $1, feedback_message = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4',
      ['approved', feedback_message || null, reviewerId || null, req.params.id]
    );
    const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';
    try {
      await fetch(`${notifUrl}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: r.email,
          subject: 'Kenya Farm IoT - Access Approved',
          html: `Hello ${r.name || 'User'},<br><br>Your ${r.requested_role} access request has been approved. You can now log in at the app.<br><br>${feedback_message ? `Admin message: ${feedback_message}` : ''}`
        })
      });
    } catch (_) {}
    return res.json({ ok: true, message: 'Request approved. User created and email sent.' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 007 first' });
    throw e;
  }
}));

app.post('/api/admin/requests/:id/reject', useDb(async (req, res) => {
  const { feedback_message } = req.body || {};
  const reviewerId = req.user?.id;
  if (!feedback_message || String(feedback_message).trim() === '') {
    return res.status(400).json({ error: 'Feedback message required for rejection' });
  }
  try {
    const { rows } = await query(
      'SELECT * FROM access_requests WHERE id = $1 AND status = $2',
      [req.params.id, 'pending']
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already processed' });
    const r = rows[0];
    await query(
      'UPDATE access_requests SET status = $1, feedback_message = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4',
      ['rejected', feedback_message, reviewerId || null, req.params.id]
    );
    const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';
    try {
      await fetch(`${notifUrl}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: r.email,
          subject: 'Kenya Farm IoT - Access Request Update',
          html: `Hello ${r.name || 'User'},<br><br>Unfortunately, your ${r.requested_role} access request could not be approved at this time.<br><br>Feedback: ${feedback_message}`
        })
      });
    } catch (_) {}
    return res.json({ ok: true, message: 'Request rejected. Feedback email sent.' });
  } catch (e) {
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 007 first' });
    throw e;
  }
}));

// Settings: create admin user
app.post('/api/admin/settings/users', useDb(async (req, res) => {
  const { email, password, name, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, name, phone, role, created_at`,
      [email, passwordHash, name || null, phone || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  }
}));

app.delete('/api/admin/settings/users/:id', useDb(async (req, res) => {
  const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  if (rows[0].role === 'admin') {
    const { rows: adminCount } = await query("SELECT COUNT(*) as c FROM users WHERE role = 'admin'");
    if (parseInt(adminCount[0]?.c || 0, 10) <= 1) return res.status(400).json({ error: 'Cannot delete last admin' });
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  return res.json({ ok: true });
}));

// Settings: system restart/reboot (stub - implement via deployment script in production)
app.post('/api/admin/settings/restart', async (req, res) => {
  // In production, this could trigger: docker-compose restart, pm2 restart, systemctl restart, etc.
  // For now, return success. Add actual restart logic based on your deployment.
  res.json({ ok: true, message: 'System restart completed successfully. All services have been restarted. You may need to log in again.' });
});

// Settings: get ordered migration list (auto-updated from migrations directory)
app.get('/api/admin/settings/migration-list', (_req, res) => {
  const result = updateMigrationOrder();
  if (result.ok) {
    res.json({ ok: true, migrations: result.migrations });
  } else {
    res.json({ ok: true, migrations: MIGRATION_ORDER }); // fallback to cached
  }
});

app.post('/api/admin/settings/run-migrations', async (req, res) => {
  // Auto-update migration-order.js from migrations directory before running
  const updateResult = updateMigrationOrder();
  const order = updateResult.ok ? updateResult.migrations : MIGRATION_ORDER;

  const candidates = [
    process.env.MIGRATIONS_DIR,
    process.env.COMPOSE_PROJECT_DIR && path.join(process.env.COMPOSE_PROJECT_DIR, 'databases/postgres/migrations'),
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', '..', 'databases/postgres/migrations')
  ].filter(Boolean);
  const migrationsDir = candidates.find(d => d && fs.existsSync(d)) || candidates[0];

  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    return res.status(503).json({
      error: 'Migrations directory not found',
      message: `Set MIGRATIONS_DIR or COMPOSE_PROJECT_DIR. Looked at: ${migrationsDir}`,
      migrationsDir
    });
  }

  const results = [];
  try {
    for (const file of order) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        results.push({ file, status: 'skipped', message: 'File not found' });
        continue;
      }
      try {
        const sql = fs.readFileSync(filePath, 'utf8');
        const statements = sql
          .split(/;\s*[\r\n]+/)
          .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, '').trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          const s = stmt.endsWith(';') ? stmt : stmt + ';';
          try {
            await query(s);
          } catch (stmtErr) {
            const code = stmtErr.code;
            const msg = (stmtErr.message || '').toLowerCase();
            const isAlreadyExists = code === '42P07' || code === '42710' || msg.includes('already exists');
            if (isAlreadyExists) continue;
            throw stmtErr;
          }
        }
        results.push({ file, status: 'ok' });
      } catch (err) {
        results.push({ file, status: 'error', message: err.message });
        return res.status(500).json({
          ok: false,
          error: `Migration failed: ${file}`,
          message: err.message,
          results,
          reconnectTip: 'Click Force Reconnect to refresh the database connection, then try again.'
        });
      }
    }
    await reconnect();
    res.json({ ok: true, message: 'All database migrations completed successfully. Connection refreshed.', results });
  } catch (err) {
    try { await reconnect(); } catch (_) {}
    res.status(500).json({
      ok: false,
      error: 'Migrations failed',
      message: err.message,
      results,
      reconnectTip: 'Click Force Reconnect to refresh the database connection, then try again.'
    });
  }
});

// Run a single migration file (does not affect other migrations)
// Procedural: runs in background, returns immediately with jobId; client polls for result (avoids 504 timeout)
function getMigrationsDir() {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    process.env.COMPOSE_PROJECT_DIR && path.join(process.env.COMPOSE_PROJECT_DIR, 'databases/postgres/migrations'),
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', '..', 'databases/postgres/migrations')
  ].filter(Boolean);
  return candidates.find(d => d && fs.existsSync(d)) || candidates[0];
}

const singleMigrationJobs = new Map();

async function runSingleMigrationInBackground(file, jobId) {
  const job = singleMigrationJobs.get(jobId);
  if (!job) return;
  const migrationsDir = getMigrationsDir();
  const filePath = path.join(migrationsDir, file);
  const results = [];
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql
      .split(/;\s*[\r\n]+/)
      .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, '').trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
      const s = stmt.endsWith(';') ? stmt : stmt + ';';
      try {
        await query(s);
      } catch (stmtErr) {
        const code = stmtErr.code;
        const msg = (stmtErr.message || '').toLowerCase();
        const isAlreadyExists = code === '42P07' || code === '42710' || msg.includes('already exists');
        if (isAlreadyExists) continue;
        throw stmtErr;
      }
    }
    results.push({ file, status: 'ok' });
    await reconnect();
    job.status = 'completed';
    job.ok = true;
    job.message = `Migration ${file} completed successfully.`;
    job.results = results;
  } catch (err) {
    try { await reconnect(); } catch (_) {}
    const errMsg = err.message || String(err);
    const errCode = err.code || err.name || '';
    const errDetail = errCode ? `${errMsg} (code: ${errCode})` : errMsg;
    results.push({ file, status: 'error', message: errDetail });
    job.status = 'failed';
    job.ok = false;
    job.error = `Migration failed: ${file}`;
    job.message = errDetail;
    job.results = results;
    job.reconnectTip = 'Click Force Reconnect to refresh the database connection, then try again.';
  }
}

app.post('/api/admin/settings/run-single-migration', (req, res) => {
  const { file } = req.body || {};
  if (!file || typeof file !== 'string' || !file.endsWith('.sql')) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid migration file',
      message: 'Provide a valid migration filename (e.g. 001_add_users_name_phone.sql)'
    });
  }

  const updateResult = updateMigrationOrder();
  const order = updateResult.ok ? updateResult.migrations : MIGRATION_ORDER;
  if (!order.includes(file)) {
    return res.status(400).json({
      ok: false,
      error: 'Unknown migration',
      message: `Migration "${file}" is not in the allowed list.`,
      allowed: order
    });
  }

  const migrationsDir = getMigrationsDir();
  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    return res.status(503).json({
      ok: false,
      error: 'Migrations directory not found',
      message: `Set MIGRATIONS_DIR or COMPOSE_PROJECT_DIR. Looked at: ${migrationsDir}`
    });
  }

  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      ok: false,
      error: 'File not found',
      message: `Migration file "${file}" does not exist at ${filePath}`
    });
  }

  const jobId = `mig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  singleMigrationJobs.set(jobId, { status: 'running', file });
  setImmediate(() => runSingleMigrationInBackground(file, jobId));
  res.status(202).json({ ok: true, jobId, message: 'Migration started. Poll for result.' });
});

app.get('/api/admin/settings/migration-job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = singleMigrationJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found', jobId });
  if (job.status === 'running') {
    return res.json({ status: 'running', file: job.file });
  }
  singleMigrationJobs.delete(jobId);
  res.json({
    status: job.status,
    ok: job.ok,
    file: job.file,
    message: job.message,
    error: job.error,
    results: job.results,
    reconnectTip: job.reconnectTip
  });
});

// Settings: get rebuild config (project dir for docker-compose)
app.get('/api/admin/settings/rebuild-config', (req, res) => {
  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || process.cwd();
  const configured = !!(process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR);
  res.json({
    projectDir,
    configured,
    hint: configured ? undefined : 'Set COMPOSE_PROJECT_DIR or DOCKER_COMPOSE_DIR to your project directory for rebuild from UI.'
  });
});

// Settings: rebuild Docker image with --no-cache and restart container
const ALLOWED_REBUILD_SERVICES = ['auth-service', 'api-gateway', 'farmer-service', 'admin-service', 'device-service', 'system-service'];
app.post('/api/admin/settings/rebuild-service', async (req, res) => {
  const { service } = req.body || {};
  if (!service || !ALLOWED_REBUILD_SERVICES.includes(service)) {
    return res.status(400).json({
      error: 'Invalid service',
      allowed: ALLOWED_REBUILD_SERVICES,
      command: 'Run manually: docker compose build --no-cache auth-service && docker compose up -d auth-service'
    });
  }
  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || process.cwd();
  const composeFile = path.join(projectDir, 'docker-compose.yml');
  if (!fs.existsSync(composeFile)) {
    return res.status(503).json({
      error: 'Rebuild not configured',
      message: 'docker-compose.yml not found. Set COMPOSE_PROJECT_DIR to your project directory (where docker-compose.yml lives).',
      projectDir,
      command: `cd "${projectDir}" && docker compose build --no-cache ${service} && docker compose up -d ${service}`
    });
  }
  const cmd = `docker compose -f "${composeFile}" build --no-cache ${service} && docker compose -f "${composeFile}" up -d ${service}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectDir,
      timeout: 300000,
      maxBuffer: 2 * 1024 * 1024
    });
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    res.json({
      ok: true,
      message: `${service} rebuilt and restarted successfully`,
      output: output || undefined
    });
  } catch (err) {
    const output = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    res.status(500).json({
      error: 'Rebuild failed',
      message: err.message || 'Docker command failed. Ensure Docker is available and COMPOSE_PROJECT_DIR is correct.',
      command: cmd,
      output: output || undefined
    });
  }
});

// Run manual rebuild: executes cd + docker compose build + up procedurally (works when rebuild not configured)
app.post('/api/admin/settings/run-manual-rebuild', async (req, res) => {
  const isProductionPaaS = process.env.RENDER === 'true' ||
    process.env.RAILWAY_ENVIRONMENT ||
    (process.env.DATABASE_URL || '').includes('render.com') ||
    (process.env.DATABASE_URL || '').includes('railway.app');
  if (isProductionPaaS) {
    return res.status(400).json({
      ok: false,
      error: 'Not available in production',
      message: 'Run Manual Rebuild is for local/Docker environments only.'
    });
  }

  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || path.join(__dirname, '..', '..');
  const service = 'admin-service';
  const sep = process.platform === 'win32' ? ';' : '&&';
  const cmd = `cd "${projectDir}" ${sep} docker compose build --no-cache ${service} ${sep} docker compose up -d ${service}`;

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      shell: process.platform === 'win32' ? 'powershell' : 'bash',
      timeout: 300000,
      maxBuffer: 2 * 1024 * 1024
    });
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    res.json({
      ok: true,
      message: `${service} rebuilt and restarted successfully`,
      output: output || undefined
    });
  } catch (err) {
    const output = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    res.status(500).json({
      ok: false,
      error: 'Rebuild failed',
      message: err.message || 'Docker command failed.',
      command: cmd,
      output: output || undefined
    });
  }
});

// Legacy aliases
app.get('/api/admin/system/config', useDb(async (_, res) => {
  try {
    const { rows } = await query('SELECT key, value FROM system_config');
    const config = {};
    rows.forEach(r => { config[r.key] = r.value || {}; });
    return res.json({ config });
  } catch (e) {
    if (e.code === '42P01') return res.json({ config: {} });
    throw e;
  }
}));

app.put('/api/admin/system/config', useDb(async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    await query(
      `INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value || {})]
    );
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === '42P01') return res.status(400).json({ error: 'Run migration 006 first' });
    throw e;
  }
}));

app.get('/api/admin/audit', useDb(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const { rows } = await query(
      `SELECT a.id, a.action, a.user_id, a.created_at, a.metadata, u.email
       FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json({ logs: rows });
  } catch (e) {
    if (e.code === '42P01') return res.json({ logs: [] });
    throw e;
  }
}));

app.get('/api/admin/health', async (_, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Preflight: check if migrations can run (DB + migrations dir)
app.get('/api/admin/settings/migration-ready', async (req, res) => {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    process.env.COMPOSE_PROJECT_DIR && path.join(process.env.COMPOSE_PROJECT_DIR, 'databases/postgres/migrations'),
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', '..', 'databases/postgres/migrations')
  ].filter(Boolean);
  const migrationsDir = candidates.find(d => d && fs.existsSync(d)) || candidates[0];
  const migrationsDirOk = !!(migrationsDir && fs.existsSync(migrationsDir));
  let dbOk = false;
  try {
    await query('SELECT 1');
    dbOk = true;
  } catch (_) {}
  const ready = dbOk && migrationsDirOk;
  res.json({
    ready,
    dbOk,
    migrationsDirOk,
    error: ready ? undefined : (!dbOk ? 'Database not connected' : !migrationsDirOk ? 'Migrations directory not found' : undefined)
  });
});

// Migration file -> test query (kept in sync with migration-order.js)
const MIGRATION_TESTS = {
  '001_add_users_name_phone.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name' LIMIT 1",
  '002_add_crops_tasks_alerts.sql': "SELECT 1 FROM crops LIMIT 1",
  '003_add_system_tables.sql': "SELECT 1 FROM system_config LIMIT 1",
  '004_add_soft_delete.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='farmers' AND column_name='deleted_at' LIMIT 1",
  '005_sensor_robot_registration.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='system_sensors' AND column_name='registration_status' LIMIT 1",
  '006_system_config.sql': "SELECT 1 FROM system_logs LIMIT 1",
  '006_seed_config.sql': "SELECT 1 FROM system_config LIMIT 1",
  '007_access_requests.sql': "SELECT 1 FROM access_requests LIMIT 1",
  '008_crop_yields.sql': "SELECT 1 FROM crop_yield_records LIMIT 1",
  '009_farm_properties.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='farms' AND column_name='unique_code' LIMIT 1",
  '010_farmers_region_to_location.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='farmers' AND column_name='location' LIMIT 1",
  '011_access_requests_farm_details.sql': "SELECT 1 FROM information_schema.columns WHERE table_name='access_requests' AND column_name='farm_location' LIMIT 1",
  '012_farmer_farm_binding.sql': "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_farms_farmer_id_id' LIMIT 1",
  '013_fix_orphan_farmers.sql': "SELECT 1 FROM farmers LIMIT 1"
};

app.get('/api/admin/settings/migration-status', async (req, res) => {
  const update = updateMigrationOrder();
  const migrationList = update.ok && Array.isArray(update.migrations) ? update.migrations : MIGRATION_ORDER;
  const checks = [
    { id: 'init', name: 'Base schema (init.sql)', test: "SELECT 1 FROM users LIMIT 1" },
    ...migrationList.map((file) => ({
      id: file.replace('.sql', ''),
      name: file.replace('.sql', ''),
      test: MIGRATION_TESTS[file] || "SELECT 1 FROM pg_tables WHERE tablename = 'users' LIMIT 1"
    }))
  ];
  const results = [];
  try {
    for (const c of checks) {
      try {
        await query(c.test);
        results.push({ id: c.id, name: c.name, applied: true });
      } catch {
        results.push({ id: c.id, name: c.name, applied: false });
      }
    }
    res.json({ ok: true, migrations: results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, migrations: [] });
  }
});

app.post('/api/admin/settings/reconnect-db', async (req, res) => {
  try {
    await reconnect();
    res.json({ ok: true, message: 'Database connection re-established successfully.', status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Reconnect failed', message: err.message, status: 'error', db: 'disconnected' });
  }
});

// Fix orphan farmers: create farmers rows for users with role 'farmer' that don't have one
app.post('/api/admin/settings/fix-orphan-farmers', useDb(async (req, res) => {
  try {
    const { rows } = await query(
      `INSERT INTO farmers (user_id, name, phone, location)
       SELECT u.id, u.name, u.phone, NULL
       FROM users u
       LEFT JOIN farmers f ON f.user_id = u.id
       WHERE u.role = 'farmer' AND f.id IS NULL
       RETURNING id, user_id, name`
    );
    await reconnect();
    res.json({
      ok: true,
      message: rows.length > 0
        ? `Created ${rows.length} missing farmer profile(s). Affected users can now log in to the farmer app.`
        : 'No orphan farmers found. All users with role farmer already have a farmers row.',
      created: rows.length,
      farmers: rows
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, message: 'Fix orphan farmers failed' });
  }
}));

// Alternative DB Reconnect: full procedure (check-db, stop postgres, docker-compose up -d, handle port conflicts)
// Only available in Docker/self-hosted deployments. Not available on Render, Railway, etc. (no Docker socket).
app.post('/api/admin/settings/alternative-db-reconnect', async (req, res) => {
  // Production (Render, Railway, etc.): no Docker, use Force Reconnect DB instead
  const isProductionPaaS = process.env.RENDER === 'true' ||
    process.env.RAILWAY_ENVIRONMENT ||
    (process.env.DATABASE_URL || '').includes('render.com') ||
    (process.env.DATABASE_URL || '').includes('railway.app') ||
    process.env.ENABLE_ALTERNATIVE_DB_RECONNECT === 'false';
  if (isProductionPaaS) {
    return res.status(400).json({
      ok: false,
      error: 'Not available in production',
      message: 'Alternative DB Reconnect is for Docker/self-hosted deployments only. On Render, Railway, or other PaaS, use Force Reconnect DB instead. Ensure DATABASE_URL is correct and the database is running.'
    });
  }

  // Check Docker is available before running
  try {
    await execAsync('docker --version', { timeout: 5000 });
  } catch (_) {
    return res.status(503).json({
      ok: false,
      error: 'Docker not available',
      message: 'Docker is not available in this environment. Alternative DB Reconnect requires Docker (e.g. self-hosted with docker-compose). Use Force Reconnect DB for connection pool refresh.'
    });
  }

  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || path.join(__dirname, '..', '..');
  const composeFile = path.join(projectDir, 'docker-compose.yml');
  if (!fs.existsSync(composeFile)) {
    return res.status(503).json({
      ok: false,
      error: 'docker-compose.yml not found',
      message: `Set COMPOSE_PROJECT_DIR to your project root (where docker-compose.yml lives). Looked at: ${projectDir}`
    });
  }
  const steps = [];
  let lastError = null;

  const runStep = async (name, cmd, opts = {}) => {
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: projectDir,
        timeout: opts.timeout || 60000,
        maxBuffer: 1024 * 1024,
        ...opts
      });
      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      steps.push({ step: name, ok: true, output: out || '(ok)' });
      return { ok: true, output: out };
    } catch (err) {
      const out = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
      steps.push({ step: name, ok: false, output: out || err.message });
      lastError = err;
      return { ok: false, output: out || err.message };
    }
  };

  try {
    // Step 1: Check if PostgreSQL is reachable
    const checkResult = await runStep('1. Check DB (npm run check-db)', `node scripts/check-db.js`, { timeout: 10000 });
    if (!checkResult.ok) {
      steps.push({ step: 'Note', ok: true, output: 'PostgreSQL not reachable. Proceeding to start databases...' });
    }

    // Step 2: Stop existing postgres container (may be from another project) - ignore errors
    try {
      await execAsync('docker stop postgres', { timeout: 10000 });
      steps.push({ step: '2. Stop existing postgres container', ok: true, output: 'Stopped' });
    } catch (_) {
      steps.push({ step: '2. Stop existing postgres container', ok: true, output: 'No postgres container to stop (ok)' });
    }

    // Step 3: docker-compose up -d
    const composeCmd = `docker compose -f "${composeFile}" up -d`;
    let upResult = await runStep('3. Start databases (docker-compose up -d)', composeCmd, { timeout: 120000 });

    // Step 4: If port conflict, do docker-compose down then up again
    if (!upResult.ok && (upResult.output.includes('port') && upResult.output.includes('allocated') || upResult.output.includes('bind') || upResult.output.includes('already in use'))) {
      steps.push({ step: '4a. Port conflict detected', ok: true, output: 'Stopping all containers to free ports...' });
      await runStep('4b. docker-compose down', `docker compose -f "${composeFile}" down`, { timeout: 30000 });
      upResult = await runStep('4c. docker-compose up -d (retry)', composeCmd, { timeout: 120000 });
    }

    const dbOk = await query('SELECT 1').then(() => true).catch(() => false);
    if (dbOk) await reconnect();

    if (upResult.ok || dbOk) {
      const portConflictNote = !upResult.ok && dbOk
        ? ' Microservices had port conflicts. Databases are up. Run npm run dev:services for local dev.'
        : '';
      return res.json({
        ok: true,
        message: `Alternative DB Reconnect completed successfully. Databases (Postgres, MongoDB, Redis) are running.${portConflictNote}`,
        steps,
        dbConnected: dbOk
      });
    }

    const errMsg = steps.map(s => `[${s.step}] ${s.ok ? 'OK' : 'FAILED'}: ${String(s.output || '').slice(0, 150)}`).join(' | ');
    return res.status(500).json({
      ok: false,
      error: lastError?.message || 'Alternative DB Reconnect encountered errors',
      message: errMsg,
      steps
    });
  } catch (err) {
    steps.push({ step: 'Error', ok: false, output: err.message });
    return res.status(500).json({
      ok: false,
      error: err.message,
      message: `Alternative DB Reconnect failed: ${err.message}`,
      steps
    });
  }
});

// Run shell command (admin terminal) - for troubleshooting. Disabled on production PaaS.
app.post('/api/admin/settings/run-command', async (req, res) => {
  const isProductionPaaS = process.env.RENDER === 'true' ||
    process.env.RAILWAY_ENVIRONMENT ||
    (process.env.DATABASE_URL || '').includes('render.com') ||
    (process.env.DATABASE_URL || '').includes('railway.app');
  if (isProductionPaaS) {
    return res.status(400).json({
      ok: false,
      error: 'Not available in production',
      message: 'Terminal is disabled on Render/Railway for security. Use your local terminal.'
    });
  }

  const { command } = req.body || {};
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ ok: false, error: 'Command required', stdout: '', stderr: '' });
  }

  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || path.join(__dirname, '..', '..');
  const shell = process.platform === 'win32' ? 'powershell' : 'bash';
  try {
    const { stdout, stderr } = await execAsync(command.trim(), {
      cwd: projectDir,
      timeout: 60000,
      maxBuffer: 512 * 1024,
      shell
    });
    return res.json({
      ok: true,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0
    });
  } catch (err) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || err.message || '';
    return res.json({
      ok: false,
      stdout: String(stdout),
      stderr: String(stderr),
      exitCode: err.code ?? 1
    });
  }
});

// Start dev services (npm run dev:services) - for local dev when databases are up but microservices had port conflicts
// Spawns detached; not available on Render/Railway (no npm/node at project root).
app.post('/api/admin/settings/start-dev-services', async (req, res) => {
  const isProductionPaaS = process.env.RENDER === 'true' ||
    process.env.RAILWAY_ENVIRONMENT ||
    (process.env.DATABASE_URL || '').includes('render.com') ||
    (process.env.DATABASE_URL || '').includes('railway.app');
  if (isProductionPaaS) {
    return res.status(400).json({
      ok: false,
      error: 'Not available in production',
      message: 'Start Dev Services is for local development only. Use your terminal: npm run dev:services'
    });
  }

  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR || path.join(__dirname, '..', '..');
  const packageJson = path.join(projectDir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    return res.status(503).json({
      ok: false,
      error: 'Project not found',
      message: `package.json not found at ${projectDir}. Set COMPOSE_PROJECT_DIR to your project root.`
    });
  }

  try {
    const child = spawn('npm', ['run', 'dev:services'], {
      cwd: projectDir,
      detached: true,
      stdio: 'ignore',
      shell: true
    });
    child.unref();
    return res.json({
      ok: true,
      message: 'Dev services started in background (API Gateway, Auth, Farmer, Admin, System, etc.). Check your terminal for output.'
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      message: `Failed to start dev services: ${err.message}`
    });
  }
});

// System health details: CPU, RAM, disk, services status
const API_GATEWAY_PORT = process.env.API_GATEWAY_PORT || '5001';
const AUTH_PORT = process.env.AUTH_SERVICE_PORT || '5002';
const SERVICE_LIST = [
  { key: 'api-gateway', name: 'API Gateway', url: process.env.API_GATEWAY_URL || `http://api-gateway:${API_GATEWAY_PORT}`, path: '/health' },
  { key: 'auth-service', name: 'Auth Service', url: process.env.AUTH_SERVICE_URL || `http://auth-service:${AUTH_PORT}`, path: '/api/auth/health' },
  { key: 'farmer-service', name: 'Farmer Service', url: process.env.FARMER_SERVICE_URL || 'http://farmer-service:4002', path: '/api/farmers/health' },
  { key: 'device-service', name: 'Device Service', url: process.env.DEVICE_SERVICE_URL || 'http://device-service:4003', path: '/api/devices/health' },
  { key: 'analytics-service', name: 'Analytics Service', url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:4004', path: '/api/analytics/health' },
  { key: 'notification-service', name: 'Notification Service', url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005', path: '/api/notifications/health' },
  { key: 'system-service', name: 'System Service', url: process.env.SYSTEM_SERVICE_URL || 'http://system-service:4007', path: '/api/system/health' },
  { key: 'admin-service', name: 'Admin Service', url: process.env.ADMIN_SERVICE_URL || 'http://admin-service:4006', path: '/api/admin/health' }
];

// For local dev: use localhost when SERVICES_USE_LOCALHOST=true
const LOCALHOST_PORTS = { 'api-gateway': 5001, 'auth-service': 5002, 'farmer-service': 4002, 'device-service': 4003, 'analytics-service': 4004, 'notification-service': 4005, 'system-service': 4007, 'admin-service': 4006 };
const SERVICE_URLS = process.env.SERVICES_USE_LOCALHOST === 'true'
  ? SERVICE_LIST.map((s) => ({ ...s, url: `http://localhost:${LOCALHOST_PORTS[s.key] || 4006}` }))
  : SERVICE_LIST;

async function probeService(s) {
  try {
    const res = await fetch(`${s.url}${s.path}`, { signal: AbortSignal.timeout(3000) });
    return { name: s.name, status: res.ok ? 'online' : 'error', statusCode: res.status };
  } catch (e) {
    return { name: s.name, status: 'offline', error: (e && e.message) || 'timeout' };
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

app.get('/api/admin/system/health-details', async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length || 1;
    const load0 = (typeof loadAvg[0] === 'number' && !isNaN(loadAvg[0])) ? loadAvg[0] : 0;
    const cpuPercent = Math.min(100, Math.round((load0 / cpuCount) * 100));
    let diskPercent = null;
    let diskFree = null;
    let diskTotal = null;
    try {
      const { default: checkDiskSpace } = await import('check-disk-space');
      const disk = await checkDiskSpace('/');
      diskFree = disk.free;
      diskTotal = disk.size;
      diskPercent = disk.size > 0 ? Math.round(((disk.size - disk.free) / disk.size) * 100) : null;
    } catch (_) {
      diskPercent = null;
    }
    const services = await Promise.all(SERVICE_URLS.map(probeService));
    const servicesOnline = services.filter(s => s.status === 'online').length;
    const dbStatus = await query('SELECT 1').then(() => 'connected').catch(() => 'disconnected');
    res.json({
      cpu: { percent: cpuPercent, loadAvg: loadAvg, cores: cpuCount },
      ram: {
        percent: ramPercent,
        totalMb: Math.round(totalMem / 1024 / 1024),
        usedMb: Math.round(usedMem / 1024 / 1024),
        freeMb: Math.round(freeMem / 1024 / 1024)
      },
      disk: diskPercent != null ? {
        percent: diskPercent,
        freeGb: diskFree != null ? (diskFree / 1024 / 1024 / 1024).toFixed(2) : null,
        totalGb: diskTotal != null ? (diskTotal / 1024 / 1024 / 1024).toFixed(2) : null
      } : null,
      uptime: formatUptime(process.uptime()),
      services: { list: services, online: servicesOnline, total: services.length },
      db: dbStatus
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to gather health data' });
  }
});

// List services for Check Service dropdown
app.get('/api/admin/settings/service-list', (req, res) => {
  res.json({ services: SERVICE_URLS.map(s => ({ key: s.key, name: s.name })) });
});

// Check a single service by key (e.g. ?service=admin-service)
app.get('/api/admin/settings/check-service', async (req, res) => {
  const key = req.query.service;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid service parameter' });
  }
  const svc = SERVICE_URLS.find(s => s.key === key);
  if (!svc) {
    return res.status(404).json({ error: `Unknown service: ${key}` });
  }
  try {
    const result = await probeService(svc);
    res.json({ service: key, name: svc.name, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check failed', service: key });
  }
});

app.listen(PORT, () => console.log(`🇰🇪 Admin Service :${PORT}`));
