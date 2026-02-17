// Quick test - no DB deps. Run: node scripts/quick-farmer-test.js
const API = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const FARMER_API = 'http://localhost:4002'; // Direct farmer-service
async function run() {
  console.log('1. Login via gateway...');
  const login = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-farmer-1771188428992@test.kenya.io', password: 'test123' })
  });
  const loginData = await login.json();
  if (!loginData.token) {
    console.log('Login failed:', loginData);
    return;
  }
  console.log('OK. Token:', loginData.token.slice(0, 20) + '...');
  console.log('2a. Fetch /api/farmers/me via GATEWAY (5001)...');
  const meGateway = await fetch(API + '/api/farmers/me', {
    headers: { Authorization: 'Bearer ' + loginData.token }
  });
  console.log('   Gateway status:', meGateway.status);
  const gwText = await meGateway.text();
  if (meGateway.ok) {
    const gw = JSON.parse(gwText);
    console.log('   Farms:', gw.farms?.map(f => f.name) || []);
  } else console.log('   Body:', gwText.slice(0, 150));
  console.log('2b. Fetch /api/farmers/me DIRECT to farmer-service (4002)...');
  const meDirect = await fetch(FARMER_API + '/api/farmers/me', {
    headers: { Authorization: 'Bearer ' + loginData.token }
  });
  console.log('   Direct status:', meDirect.status);
  const directText = await meDirect.text();
  if (meDirect.ok) {
    const d = JSON.parse(directText);
    console.log('   Farmer:', d.farmer?.name);
    console.log('   Farms:', d.farms?.map(f => f.name) || []);
  } else console.log('   Body:', directText.slice(0, 150));
}
run().catch(e => console.error(e));
