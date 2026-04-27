// scripts/e2e.js
// End-to-end smoke test for the API.
// Usage:
//   node scripts/e2e.js                # starts app on a random port
//   node scripts/e2e.js http://localhost:3000

const { app, initDatabase } = require('../src/app');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

async function requestJson(baseUrl, method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { status: res.status, headers: res.headers, json, text };
}

async function requestText(baseUrl, method, path) {
  const res = await fetch(`${baseUrl}${path}`, { method });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function startEphemeralServer() {
  await initDatabase();

  return await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      if (!port) return reject(new Error('Failed to bind to an ephemeral port'));
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function run() {
  if (typeof fetch !== 'function') {
    fail('Node fetch() is not available. Use Node 18+ or add a fetch polyfill.');
    return;
  }

  const argBase = process.argv[2] || process.env.API_BASE_URL;

  let server = null;
  let baseUrl = argBase ? String(argBase).replace(/\/$/, '') : null;

  if (!baseUrl) {
    const started = await startEphemeralServer();
    server = started.server;
    baseUrl = started.baseUrl;
    ok(`Started server: ${baseUrl}`);
  } else {
    ok(`Using existing server: ${baseUrl}`);
  }

  try {
    // Health
    {
      const res = await requestJson(baseUrl, 'GET', '/api/health');
      if (res.status !== 200) fail(`GET /api/health expected 200, got ${res.status}`);
      else ok('GET /api/health');
    }

    // Docs
    {
      const res = await requestText(baseUrl, 'GET', '/api-docs');
      if (res.status !== 200) fail(`GET /api-docs expected 200, got ${res.status}`);
      else ok('GET /api-docs');

      const jsonRes = await requestJson(baseUrl, 'GET', '/api/swagger.json');
      if (jsonRes.status !== 200) fail(`GET /api/swagger.json expected 200, got ${jsonRes.status}`);
      else if (!jsonRes.json || !jsonRes.json.openapi) fail('OpenAPI JSON missing `openapi` field');
      else ok('GET /api/swagger.json');
    }

    // Login as ADMIN
    let adminToken = null;
    {
      const res = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        body: { username: 'admin', password: 'Admin@1234' },
      });
      if (res.status !== 200 || !res.json || !res.json.token) {
        fail(`ADMIN login failed (status ${res.status})`);
      } else {
        adminToken = res.json.token;
        ok('POST /api/auth/login (ADMIN)');
      }
    }

    // ADMIN protected endpoints
    {
      const me = await requestJson(baseUrl, 'GET', '/api/auth/me', { token: adminToken });
      if (me.status !== 200 || !me.json || me.json.success !== true) fail('ADMIN GET /api/auth/me failed');
      else ok('GET /api/auth/me (ADMIN)');

      const provinces = await requestJson(baseUrl, 'GET', '/api/provinces', { token: adminToken });
      if (provinces.status !== 200 || !provinces.json || provinces.json.success !== true) fail('ADMIN GET /api/provinces failed');
      else ok('GET /api/provinces (ADMIN)');

      const vehicles = await requestJson(baseUrl, 'GET', '/api/vehicles?limit=1', { token: adminToken });
      if (vehicles.status !== 200 || !vehicles.json || vehicles.json.success !== true) fail('ADMIN GET /api/vehicles failed');
      else ok('GET /api/vehicles (ADMIN)');
    }

    // Login as DEVICE and push a location
    let deviceToken = null;
    let vehicleId = null;
    {
      const res = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        body: { username: 'device_dev_0001', password: 'Device@5678' },
      });
      if (res.status !== 200 || !res.json || !res.json.token) {
        fail(`DEVICE login failed (status ${res.status})`);
      } else {
        deviceToken = res.json.token;
        ok('POST /api/auth/login (DEVICE)');

        const payload = decodeJwtPayload(deviceToken);
        vehicleId = payload && payload.vehicle_id;
        if (!vehicleId) fail('DEVICE token payload missing vehicle_id');
        else ok(`Decoded DEVICE vehicle_id=${vehicleId}`);
      }
    }

    const testLat = 6.9271;
    const testLng = 79.8612;

    {
      const push = await requestJson(baseUrl, 'POST', '/api/locations', {
        token: deviceToken,
        body: {
          vehicle_id: vehicleId,
          latitude: testLat,
          longitude: testLng,
          speed: 12.3,
          heading: 90,
          accuracy: 5.2,
        },
      });

      if (push.status !== 201 || !push.json || push.json.success !== true) {
        fail(`DEVICE POST /api/locations expected 201, got ${push.status}`);
      } else {
        ok('POST /api/locations (DEVICE)');
      }
    }

    // Verify that the pushed ping is now the latest for that vehicle
    {
      const last = await requestJson(baseUrl, 'GET', `/api/vehicles/${vehicleId}/location`, { token: adminToken });
      const loc = last.json && last.json.data && last.json.data.location;

      const closeEnough = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;

      if (last.status !== 200 || !loc) {
        fail(`ADMIN GET /api/vehicles/${vehicleId}/location failed (status ${last.status})`);
      } else if (!closeEnough(loc.latitude, testLat) || !closeEnough(loc.longitude, testLng)) {
        fail('Last location does not match the newly pushed device ping');
      } else {
        ok('GET /api/vehicles/:id/location reflects latest device ping');
      }
    }

  } catch (err) {
    fail(err && err.message ? err.message : String(err));
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      ok('Stopped ephemeral server');
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\nE2E checks failed.');
    process.exit(process.exitCode);
  }

  console.log('\nAll E2E checks passed.');
}

run();
