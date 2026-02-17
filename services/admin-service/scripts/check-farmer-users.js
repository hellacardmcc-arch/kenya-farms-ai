#!/usr/bin/env node
/**
 * Check users with role farmer and their farmers table rows.
 * Run: node scripts/check-farmer-users.js
 */
import { query } from '../db.js';

async function main() {
  console.log('=== Users with role farmer ===');
  const { rows: users } = await query(
    "SELECT id, email, name, role FROM users WHERE role = 'farmer' ORDER BY created_at"
  );
  console.log(JSON.stringify(users, null, 2));
  console.log('Count:', users.length);

  console.log('\n=== Farmers table (all rows) ===');
  const { rows: farmers } = await query(
    'SELECT f.id, f.user_id, f.name, f.phone, f.location, u.email FROM farmers f JOIN users u ON u.id = f.user_id ORDER BY f.created_at'
  );
  console.log(JSON.stringify(farmers, null, 2));
  console.log('Count:', farmers.length);

  console.log('\n=== Orphan check: users with role farmer but NO farmers row ===');
  const { rows: orphans } = await query(
    `SELECT u.id, u.email, u.name FROM users u
     LEFT JOIN farmers f ON f.user_id = u.id
     WHERE u.role = 'farmer' AND f.id IS NULL`
  );
  if (orphans.length > 0) {
    console.log('Found', orphans.length, 'orphan(s) - these users need a farmers row:');
    console.log(JSON.stringify(orphans, null, 2));
  } else {
    console.log('None. All farmer users have a farmers row.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
