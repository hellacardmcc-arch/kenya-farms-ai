#!/usr/bin/env node
/**
 * Test: Farmer login -> fetch registered farm names from database
 * Run from auth-service: node scripts/test-farmer-farm-fetch.js [email] [password]
 * Or:  FARMER_EMAIL=x FARMER_PASSWORD=y node scripts/test-farmer-farm-fetch.js
 *
 * If no credentials: creates a test farmer with password "test123" and runs the flow.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import https from 'https';
import http from 'http';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const DB_URL = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';

async function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...options.headers },
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, data: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const email = process.argv[2] || process.env.FARMER_EMAIL;
  const password = process.argv[3] || process.env.FARMER_PASSWORD;

  console.log('\n=== Farmer Login -> Farm Fetch Diagnostic ===\n');
  console.log('API URL:', API_URL);
  console.log('DB URL:', DB_URL.replace(/:[^:@]+@/, ':****@'));

  let testEmail = email;
  let testPassword = password;
  let createdTestUser = false;

  if (!testEmail || !testPassword) {
    console.log('\nNo credentials provided. Creating test farmer with password "test123"...');
    const pool = new pg.Pool({ connectionString: DB_URL });
    try {
      const hash = await bcrypt.hash('test123', 10);
      const { rows: existing } = await pool.query(
        "SELECT u.id, u.email FROM users u JOIN farmers f ON f.user_id = u.id WHERE u.role = 'farmer' AND u.email LIKE 'test-farmer-%' LIMIT 1"
      );
      if (existing[0]) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, existing[0].id]);
        testEmail = existing[0].email;
        console.log('Using existing test farmer:', testEmail);
      } else {
        const { rows: u } = await pool.query(
          `INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, 'farmer') RETURNING id, email`,
          ['test-farmer-' + Date.now() + '@test.kenya.io', hash, 'Test Farmer', null]
        );
        const userId = u[0].id;
        await pool.query('INSERT INTO farmers (user_id, name, phone, location) VALUES ($1, $2, $3, $4)', [userId, 'Test Farmer', null, null]);
        const { rows: farm } = await pool.query(
          'INSERT INTO farms (farmer_id, name, location, area_hectares) SELECT f.id, $1, $2, $3 FROM farmers f WHERE f.user_id = $4 RETURNING id, name',
          ['Test Farm A', 'Nairobi', 2.5, userId]
        );
        testEmail = u[0].email;
        console.log('Created test farmer:', testEmail, 'with farm:', farm[0]?.name);
      }
      testPassword = 'test123';
      createdTestUser = true;
    } catch (e) {
      console.error('DB setup failed:', e.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }

  console.log('\n--- Step 1: Login ---');
  const loginRes = await httpRequest(API_URL + '/api/auth/login', { method: 'POST' }, { email: testEmail, password: testPassword });
  if (loginRes.status !== 200) {
    console.log('FAIL: Login returned', loginRes.status, loginRes.data);
    if (loginRes.data?.error) console.log('Error:', loginRes.data.error);
    process.exit(1);
  }
  const token = loginRes.data?.token;
  const user = loginRes.data?.user;
  if (!token) {
    console.log('FAIL: No token in login response');
    process.exit(1);
  }
  console.log('OK: Login success. User:', user?.email, '| Role:', user?.role);

  console.log('\n--- Step 2: Fetch /api/farmers/me (dashboard with farms) ---');
  const meRes = await httpRequest(API_URL + '/api/farmers/me', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
  });
  if (meRes.status === 401) {
    console.log('FAIL: Unauthorized. Token may be invalid or farmer-service JWT_SECRET mismatch.');
    process.exit(1);
  }
  if (meRes.status === 404) {
    console.log('FAIL: Farmer profile not found. User may not have a farmers row.');
    process.exit(1);
  }
  if (meRes.status !== 200) {
    console.log('FAIL: /api/farmers/me returned', meRes.status, meRes.data);
    process.exit(1);
  }

  const data = meRes.data;
  const farmer = data?.farmer;
  const farms = data?.farms || [];
  console.log('OK: Dashboard fetched.');
  console.log('  Farmer:', farmer?.name || farmer?.id || '—');
  console.log('  Farms count:', farms.length);
  if (farms.length > 0) {
    console.log('  Farm names:', farms.map((f) => f.name || f.unique_code || f.id).join(', '));
  } else {
    console.log('  (No farms in database for this farmer)');
  }

  if (createdTestUser) {
    console.log('\nNote: Test farmer was created. You can login with:', testEmail, '/ test123');
  }
  console.log('\n=== All steps passed. Farm fetch works. ===\n');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
