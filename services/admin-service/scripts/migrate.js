#!/usr/bin/env node
/**
 * Run database migrations to latest.
 * Usage: npm run migrate (from admin-service) or node scripts/migrate.js
 * Requires: DATABASE_URL (default: postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot)
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateMigrationOrder } from './update-migration-order.js';
import { MIGRATION_ORDER } from './migration-order.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '..', '..', '..', 'databases', 'postgres', 'migrations');

const connStr = process.env.DATABASE_URL || 'postgresql://kfiot:kfiot_secret@localhost:5432/kenya_farm_iot';

async function run() {
  // Auto-update migration-order.js from migrations directory before running
  const updateResult = updateMigrationOrder();
  const order = updateResult.ok ? updateResult.migrations : MIGRATION_ORDER;
  if (updateResult.ok) {
    console.log(`Migration list updated from directory (${order.length} files).\n`);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
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
    console.error('Ensure PostgreSQL is running and DATABASE_URL is correct.');
    process.exit(1);
  }

  console.log('Running migrations...\n');
  const results = [];
  for (const file of order) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) {
      results.push({ file, status: 'skipped', message: 'File not found' });
      console.log('  ○', file, '(skipped - file not found)');
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
          await pool.query(s);
        } catch (stmtErr) {
          const code = stmtErr.code;
          const msg = (stmtErr.message || '').toLowerCase();
          const isAlreadyExists = code === '42P07' || code === '42710' || msg.includes('already exists');
          if (isAlreadyExists) continue;
          throw stmtErr;
        }
      }
      results.push({ file, status: 'ok' });
      console.log('  ✓', file);
    } catch (err) {
      results.push({ file, status: 'error', message: err.message });
      console.error('  ✗', file, err.message);
      await pool.end();
      process.exit(1);
    }
  }

  await pool.end();
  console.log('\n✓ Migrations completed successfully.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
