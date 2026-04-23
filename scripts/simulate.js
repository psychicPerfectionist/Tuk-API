// scripts/simulate.js
// Simulates a GPS device pushing location pings to the API
// Run with: node scripts/simulate.js

const BASE_URL   = process.argv[2] || 'http://localhost:3000';
const USERNAME   = process.argv[3] || 'device_dev_0001';
const PASSWORD   = process.argv[4] || 'Device@5678';
const VEHICLE_ID = process.argv[5] || null;
const INTERVAL   = parseInt(process.argv[6]) || 10000; // 10 seconds

let token      = null;
let vehicleId  = VEHICLE_ID;
let lat        = 6.9271;
let lng        = 79.8612;
let heading    = Math.random() * 360;
let pingCount  = 0;

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function login() {
  console.log(`🔐 Logging in as ${USERNAME}...`);
  const result = await post('/auth/login', { username: USERNAME, password: PASSWORD });
  if (!result.token) throw new Error('Login failed: ' + result.message);
  token     = result.token;

  if (!vehicleId) {
    const payload = decodeJwtPayload(token);
    vehicleId = payload && payload.vehicle_id ? payload.vehicle_id : null;
  }

  console.log(`✅ Logged in | Role: ${result.user.role} | Vehicle ID: ${vehicleId}\n`);

  if (!vehicleId) {
    throw new Error('Could not determine vehicle_id. Pass it explicitly as argument #5.');
  }
}

function move() {
  // Turn slightly and move forward
  heading  = (heading + (Math.random() - 0.5) * 30 + 360) % 360;
  const spd   = 15 + Math.random() * 40;
  const dist  = (spd / 3600) * (INTERVAL / 1000) * 0.01;
  lat += Math.cos((heading * Math.PI) / 180) * dist;
  lng += Math.sin((heading * Math.PI) / 180) * dist;
  lat  = Math.max(5.9, Math.min(9.9, lat));
  lng  = Math.max(79.5, Math.min(81.9, lng));
  return spd;
}

async function ping() {
  const speed = move();
  pingCount++;
  const result = await post('/locations', {
    vehicle_id: vehicleId,
    latitude:   parseFloat(lat.toFixed(6)),
    longitude:  parseFloat(lng.toFixed(6)),
    speed:      parseFloat(speed.toFixed(1)),
    heading:    parseFloat(heading.toFixed(0)),
    accuracy:   parseFloat((3 + Math.random() * 8).toFixed(1)),
  });

  if (result.success) {
    console.log(`📍 Ping #${pingCount} | ${new Date().toLocaleTimeString()} | lat:${lat.toFixed(5)} lng:${lng.toFixed(5)} | ${speed.toFixed(1)} km/h`);
  } else {
    console.error(`❌ Ping failed: ${result.message}`);
  }
}

async function run() {
  console.log('\n🚗 GPS Simulator Started');
  console.log(`   API: ${BASE_URL}`);
  console.log(`   Ping every ${INTERVAL / 1000} seconds\n`);

  await login();
  await ping();

  const timer = setInterval(ping, INTERVAL);
  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log(`\n🛑 Stopped. Total pings: ${pingCount}`);
    process.exit(0);
  });
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
