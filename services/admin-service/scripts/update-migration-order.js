#!/usr/bin/env node
/**
 * Auto-update migration-order.js from the migrations directory.
 * Scans databases/postgres/migrations/*.sql, sorts chronologically, writes migration-order.js.
 * Run automatically before migrate.js and when admin maintenance migration endpoints are used.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getMigrationsDir() {
  // Prefer project-level databases/postgres/migrations (canonical source for new migrations)
  const candidates = [
    process.env.MIGRATIONS_DIR,
    process.env.COMPOSE_PROJECT_DIR && path.join(process.env.COMPOSE_PROJECT_DIR, 'databases/postgres/migrations'),
    path.resolve(__dirname, '..', '..', '..', 'databases/postgres/migrations'),
    path.resolve(process.cwd(), 'databases/postgres/migrations'),
    path.resolve(process.cwd(), '..', 'databases/postgres/migrations'),
    path.join(__dirname, '..', 'migrations')
  ].filter(Boolean);
  return candidates.find(d => d && fs.existsSync(d)) || candidates[0];
}

function sortMigrationFiles(files) {
  // Same-prefix order (e.g. 006_system_config before 006_seed_config)
  const samePrefixOrder = { '006_system_config.sql': 0, '006_seed_config.sql': 1 };
  return files.sort((a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '999', 10);
    const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '999', 10);
    if (numA !== numB) return numA - numB;
    const orderA = samePrefixOrder[a] ?? 999;
    const orderB = samePrefixOrder[b] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });
}

/**
 * Scans migrations dir, updates migration-order.js, returns the sorted list.
 * @returns {{ ok: boolean, migrations: string[], error?: string }}
 */
export function updateMigrationOrder() {
  const migrationsDir = getMigrationsDir();
  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    return { ok: false, migrations: [], error: `Migrations directory not found. Looked at: ${migrationsDir}` };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f));
  const sorted = sortMigrationFiles(files);

  const outputPath = path.join(__dirname, 'migration-order.js');
  const content = `/**
 * Auto-generated migration order - do not edit manually.
 * Updated automatically when new migrations are added.
 * Source: databases/postgres/migrations/*.sql
 */
export const MIGRATION_ORDER = ${JSON.stringify(sorted, null, 2)};
`;

  try {
    fs.writeFileSync(outputPath, content, 'utf8');
    return { ok: true, migrations: sorted };
  } catch (err) {
    return { ok: false, migrations: sorted, error: err.message };
  }
}

// CLI: node scripts/update-migration-order.js or npm run update-migration-order
const isCli = process.argv[1]?.includes('update-migration-order');
if (isCli) {
  const result = updateMigrationOrder();
  if (result.ok) {
    console.log(`Updated migration-order.js with ${result.migrations.length} migrations.`);
    result.migrations.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)} ${f}`));
  } else {
    console.error('Error:', result.error);
    process.exit(1);
  }
}
