#!/usr/bin/env node
/**
 * Check database connectivity before running dev.
 * Usage: node scripts/check-db.js  OR  npm run check-db
 * Exit 0 = OK, Exit 1 = DB not reachable
 */
const net = require('net');

const host = process.env.DATABASE_HOST || 'localhost';
const port = parseInt(process.env.DATABASE_PORT || '5432', 10);

function check() {
  const socket = new net.Socket();
  const timeout = setTimeout(() => {
    socket.destroy();
    fail('Connection timeout');
  }, 3000);
  socket.on('connect', () => {
    clearTimeout(timeout);
    socket.destroy();
    console.log(`✓ PostgreSQL reachable at ${host}:${port}`);
    process.exit(0);
  });
  socket.on('error', (err) => {
    clearTimeout(timeout);
    if (err.code === 'ECONNREFUSED') {
      fail(`PostgreSQL not reachable at ${host}:${port}`);
    } else {
      fail(err.message);
    }
  });
  socket.connect(port, host);
}

function fail(msg) {
  console.error('✗', msg);
  console.error('');
  console.error('  Start databases:  docker-compose up -d');
  console.error('  Ensure Docker Desktop is running.');
  process.exit(1);
}

check();
