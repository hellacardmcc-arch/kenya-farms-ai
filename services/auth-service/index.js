import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5002;
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

// Request access (admin or farmer) - creates pending request for approval
app.post('/api/auth/request-access', useDb(async (req, res) => {
  const { email, password, name, phone, role = 'farmer', farm_name, farm_size, message } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const roleVal = role === 'admin' ? 'admin' : 'farmer';
  if (roleVal === 'farmer' && (!farm_name || String(farm_name).trim() === '')) {
    return res.status(400).json({ error: 'Farm name required for farmer registration' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    const { rows: pending } = await query(
      'SELECT id FROM access_requests WHERE email = $1 AND status = $2',
      [email, 'pending']
    );
    if (pending.length) return res.status(409).json({ error: 'You already have a pending request. Please wait for admin approval.' });
    await query(
      `INSERT INTO access_requests (email, password_hash, name, phone, requested_role, farm_name, farm_size, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [email, passwordHash, name || null, phone || null, roleVal, roleVal === 'farmer' ? (farm_name || null) : null, roleVal === 'farmer' && farm_size != null ? parseFloat(farm_size) : null, message || null]
    );
    res.status(201).json({ ok: true, message: 'Request submitted. You will receive an email once an admin reviews it.' });
  } catch (err) {
    if (err.code === '42P01') return res.status(400).json({ error: 'Run migration 007 first' });
    throw err;
  }
}));

// Register (legacy - direct signup, still used if approval not required)
app.post('/api/auth/register', useDb(async (req, res) => {
  const { email, password, name, phone, role = 'farmer' } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const roleVal = role === 'admin' ? 'admin' : 'farmer';
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [email, passwordHash, name || null, phone || null, roleVal]
    );
    const user = rows[0];
    if (roleVal === 'farmer') {
      await query(
        'INSERT INTO farmers (user_id, name, phone, region) VALUES ($1, $2, $3, $4)',
        [user.id, name || null, phone || null, null]
      );
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  }
}));

// Login
app.post('/api/auth/login', useDb(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const { rows } = await query(
    'SELECT id, email, name, password_hash, role FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
}));

app.post('/api/auth/logout', (_, res) => res.json({ ok: true }));

app.post('/api/auth/refresh', useDb(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { rows } = await query('SELECT id, email, name, role FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    const token = jwt.sign({ id: payload.id, role: rows[0].role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}));

app.get('/api/auth/me', useDb(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { rows } = await query('SELECT id, email, name, phone, role FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    res.json({ user: { id: rows[0].id, email: rows[0].email, name: rows[0].name, phone: rows[0].phone, role: rows[0].role } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}));

app.put('/api/auth/profile', useDb(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { name, phone } = req.body || {};
    await query('UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3', [name, phone, payload.id]);
    if (payload.role === 'farmer') {
      await query('UPDATE farmers SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE user_id = $3', [name, phone, payload.id]);
    }
    const { rows } = await query('SELECT id, email, name, phone, role FROM users WHERE id = $1', [payload.id]);
    res.json({ ok: true, user: rows[0] ? { id: rows[0].id, email: rows[0].email, name: rows[0].name, phone: rows[0].phone, role: rows[0].role } : null });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}));

app.put('/api/auth/password', useDb(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [payload.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid current password' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, payload.id]);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}));

app.get('/api/auth/health', async (_, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => console.log(`🇰🇪 Auth Service :${PORT}`));
