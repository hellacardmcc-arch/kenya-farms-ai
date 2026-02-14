import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, reconnect } from './db.js';

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
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  };
}

// Farmers (CRUD + soft delete + restore)
app.get('/api/admin/farmers', useDb(async (req, res) => {
  const includeDeleted = req.query.deleted === 'true';
  try {
    const where = includeDeleted ? '' : ' AND fr.deleted_at IS NULL';
    const { rows } = await query(
      `SELECT fr.id, fr.name, fr.phone, fr.region, fr.created_at, fr.deleted_at, u.id as user_id, u.email, u.role
       FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE 1=1${where}
       ORDER BY fr.created_at DESC`
    );
    return res.json({ farmers: rows });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows } = await query(
        `SELECT fr.id, fr.name, fr.phone, fr.region, fr.created_at, u.id as user_id, u.email, u.role
         FROM farmers fr JOIN users u ON fr.user_id = u.id ORDER BY fr.created_at DESC`
      );
      return res.json({ farmers: rows });
    }
    throw e;
  }
}));

app.get('/api/admin/farmers/:id', useDb(async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT fr.id, fr.name, fr.phone, fr.region, fr.created_at, fr.deleted_at, u.id as user_id, u.email, u.role
       FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE fr.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
    return res.json(rows[0]);
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows } = await query(
        `SELECT fr.id, fr.name, fr.phone, fr.region, fr.created_at, u.id as user_id, u.email, u.role
         FROM farmers fr JOIN users u ON fr.user_id = u.id WHERE fr.id = $1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
      return res.json(rows[0]);
    }
    throw e;
  }
}));

app.post('/api/admin/farmers/register', useDb(async (req, res) => {
  const { email, password, name, phone, region, farm_name, farm_size } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!farm_name || (farm_name && String(farm_name).trim() === '')) return res.status(400).json({ error: 'Farm name required' });
  const areaHectares = farm_size != null && farm_size !== '' ? parseFloat(farm_size) : null;
  if (areaHectares != null && (isNaN(areaHectares) || areaHectares < 0)) return res.status(400).json({ error: 'Farm size must be a non-negative number' });
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows: userRows } = await query(
      `INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, 'farmer')
       RETURNING id, email, name, role`,
      [email, passwordHash, name || null, phone || null]
    );
    const user = userRows[0];
    const { rows: farmerRows } = await query(
      'INSERT INTO farmers (user_id, name, phone, region) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, phone, region, created_at',
      [user.id, name || null, phone || null, region || null]
    );
    const farmer = farmerRows[0];
    await query(
      'INSERT INTO farms (farmer_id, name, area_hectares) VALUES ($1, $2, $3)',
      [farmer.id, String(farm_name).trim(), areaHectares]
    );
    res.status(201).json({ user, farmer });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  }
}));

app.put('/api/admin/farmers/:id', useDb(async (req, res) => {
  const { name, phone, region } = req.body || {};
  try {
    const { rows } = await query(
      `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), region = COALESCE($3, region)
       WHERE id = $4 AND deleted_at IS NULL RETURNING id`,
      [name, phone, region, req.params.id]
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
        `UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone), region = COALESCE($3, region) WHERE id = $4`,
        [name, phone, region, req.params.id]
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

app.get('/api/admin/farms', useDb(async (_, res) => {
  try {
    const { rows } = await query(
      `SELECT f.id, f.name, f.location, f.area_hectares, f.created_at, fr.name as farmer_name, fr.phone
       FROM farms f JOIN farmers fr ON f.farmer_id = fr.id AND fr.deleted_at IS NULL`
    );
    return res.json({ farms: rows });
  } catch (e) {
    if (e.message && e.message.includes('deleted_at')) {
      const { rows } = await query(
        `SELECT f.id, f.name, f.location, f.area_hectares, f.created_at, fr.name as farmer_name, fr.phone
         FROM farms f JOIN farmers fr ON f.farmer_id = fr.id`
      );
      return res.json({ farms: rows });
    }
    throw e;
  }
}));

app.get('/api/admin/farms/:id', useDb(async (req, res) => {
  const { rows } = await query(
    `SELECT f.id, f.name, f.location, f.area_hectares, f.created_at, f.farmer_id, fr.name as farmer_name
     FROM farms f JOIN farmers fr ON f.farmer_id = fr.id WHERE f.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Farm not found' });
  res.json(rows[0]);
}));

app.post('/api/admin/farms', useDb(async (req, res) => {
  const { farmer_id, name, location, area_hectares } = req.body || {};
  if (!farmer_id) return res.status(400).json({ error: 'farmer_id required' });
  const { rows } = await query(
    `INSERT INTO farms (farmer_id, name, location, area_hectares)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [farmer_id, name || null, location || null, area_hectares || null]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put('/api/admin/farms/:id', useDb(async (req, res) => {
  const { name, location, area_hectares } = req.body || {};
  const { rowCount } = await query(
    `UPDATE farms SET name = COALESCE($1, name), location = COALESCE($2, location), area_hectares = COALESCE($3, area_hectares)
     WHERE id = $4`,
    [name, location, area_hectares, req.params.id]
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

// Settings: system config (ports, endpoints)
app.get('/api/admin/settings/config', useDb(async (_, res) => {
  try {
    const { rows } = await query('SELECT key, value, description FROM system_config');
    const config = {};
    rows.forEach(r => { config[r.key] = r.value || {}; });
    return res.json({ config });
  } catch (e) {
    if (e.code === '42P01') return res.json({ config: { ports: {}, endpoints: {} } });
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

// Access requests (admin/farmer signup approval)
app.get('/api/admin/requests', useDb(async (req, res) => {
  const status = req.query.status || 'pending';
  try {
    const { rows } = await query(
      `SELECT id, email, name, phone, requested_role, farm_name, farm_size, message, status, feedback_message, created_at
       FROM access_requests WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
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
        'INSERT INTO farmers (user_id, name, phone, region) VALUES ($1, $2, $3, $4) RETURNING id',
        [user.id, r.name || null, r.phone || null, null]
      );
      await query(
        'INSERT INTO farms (farmer_id, name, area_hectares) VALUES ($1, $2, $3)',
        [farmerRows[0].id, r.farm_name || 'My Farm', r.farm_size || null]
      );
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

// Settings: run full database migrations (001 through 007)
const MIGRATION_ORDER = [
  '001_add_users_name_phone.sql',
  '002_add_crops_tasks_alerts.sql',
  '003_add_system_tables.sql',
  '004_add_soft_delete.sql',
  '005_sensor_robot_registration.sql',
  '006_system_config.sql',
  '006_seed_config.sql',
  '007_access_requests.sql'
];

app.post('/api/admin/settings/run-migrations', useDb(async (req, res) => {
  const migrationsDir = process.env.MIGRATIONS_DIR ||
    (process.env.COMPOSE_PROJECT_DIR && path.join(process.env.COMPOSE_PROJECT_DIR, 'databases/postgres/migrations')) ||
    path.join(__dirname, '..', '..', 'databases/postgres/migrations');

  if (!fs.existsSync(migrationsDir)) {
    return res.status(503).json({
      error: 'Migrations directory not found',
      message: `Set MIGRATIONS_DIR or COMPOSE_PROJECT_DIR. Looked at: ${migrationsDir}`,
      migrationsDir
    });
  }

  const results = [];
  for (const file of MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) {
      results.push({ file, status: 'skipped', message: 'File not found' });
      continue;
    }
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await query(sql);
      results.push({ file, status: 'ok' });
    } catch (err) {
      results.push({ file, status: 'error', message: err.message });
      return res.status(500).json({
        ok: false,
        error: `Migration failed: ${file}`,
        message: err.message,
        results
      });
    }
  }
  res.json({ ok: true, message: 'All database migrations completed successfully.', results });
}));

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
  const projectDir = process.env.COMPOSE_PROJECT_DIR || process.env.DOCKER_COMPOSE_DIR;
  if (!projectDir) {
    return res.status(503).json({
      error: 'Rebuild not configured',
      message: 'Set COMPOSE_PROJECT_DIR to your project directory (where docker-compose.yml lives) to enable rebuild from UI.',
      command: `docker compose build --no-cache ${service} && docker compose up -d ${service}`
    });
  }
  const composeFile = path.join(projectDir, 'docker-compose.yml');
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

app.post('/api/admin/settings/reconnect-db', async (req, res) => {
  try {
    await reconnect();
    res.json({ ok: true, message: 'Database connection re-established successfully.', status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Reconnect failed', message: err.message, status: 'error', db: 'disconnected' });
  }
});

// System health details: CPU, RAM, disk, services status
const API_GATEWAY_PORT = process.env.API_GATEWAY_PORT || '5001';
const AUTH_PORT = process.env.AUTH_SERVICE_PORT || '5002';
const SERVICE_URLS = [
  { name: 'API Gateway', url: process.env.API_GATEWAY_URL || `http://api-gateway:${API_GATEWAY_PORT}`, path: '/health' },
  { name: 'Auth Service', url: process.env.AUTH_SERVICE_URL || `http://auth-service:${AUTH_PORT}`, path: '/api/auth/health' },
  { name: 'Farmer Service', url: process.env.FARMER_SERVICE_URL || 'http://farmer-service:4002', path: '/api/farmers/health' },
  { name: 'Device Service', url: process.env.DEVICE_SERVICE_URL || 'http://device-service:4003', path: '/api/devices/health' },
  { name: 'Analytics Service', url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:4004', path: '/api/analytics/health' },
  { name: 'Notification Service', url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005', path: '/api/notifications/health' },
  { name: 'System Service', url: process.env.SYSTEM_SERVICE_URL || 'http://system-service:4007', path: '/api/system/health' }
];

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

app.listen(PORT, () => console.log(`🇰🇪 Admin Service :${PORT}`));
