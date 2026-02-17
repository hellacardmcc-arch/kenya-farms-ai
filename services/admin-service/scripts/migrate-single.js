#!/usr/bin/env node
/**
 * Run a single database migration.
 * Usage: node scripts/migrate-single.js 007_access_requests.sql
 *    or: npm run migrate:007
 * Requires: DATABASE_URL (default: postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot)
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MIGRATION_ORDER } from './migration-order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '..', '..', '..', 'databases', 'postgres', 'migrations');

const connStr = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';

const file = process.argv[2] || '007_access_requests.sql';
if (!file.endsWith('.sql')) {
  console.error('Usage: node migrate-single.js <migration_file.sql>');
  console.error('Example: node migrate-single.js 007_access_requests.sql');
  process.exit(1);
}

if (!MIGRATION_ORDER.includes(file)) {
  console.error(`Unknown migration: ${file}`);
  console.error('Allowed:', MIGRATION_ORDER.join(', '));
  process.exit(1);
}

async function run() {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: connStr,
    connectionTimeoutMillis: 10000
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to database.');
  } catch (e) {
    console.error('Database connection failed:', e.message);
    process.exit(1);
  }

  console.log(`Running migration: ${file}\n`);
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql
      .split(/;\s*[\r\n]+/)
      .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, '').trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
      const s = stmt.endsWith(';') ? stmt : stmt + ';';
      try {
        await pool.query(s);
      } catch (stmtErr) {
        const code = stmtErr.code;
        const msg = (stmtErr.message || '').toLowerCase();
        const isAlreadyExists = code === '42P07' || code === '42710' || msg.includes('already exists');
        if (isAlreadyExists) continue;
        throw stmtErr;
      }
    }
    console.log('✓', file, '- completed successfully.');
  } catch (err) {
    console.error('✗', file, '- failed:', err.message);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
