// scripts/e2e.js
// End-to-end smoke test for the API.
// Usage:
//   node scripts/e2e.js                # starts app on a random port
//   node scripts/e2e.js http://localhost:3000

const app = require('../src/app');

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
      const res = await requestJson(baseUrl, 'GET', '/api/v1/health');
      if (res.status !== 200) fail(`GET /api/v1/health expected 200, got ${res.status}`);
      else ok('GET /api/v1/health');
    }

    // Docs
    {
      const res = await requestText(baseUrl, 'GET', '/api-docs');
      if (res.status !== 200) fail(`GET /api-docs expected 200, got ${res.status}`);
      else ok('GET /api-docs');

      const jsonRes = await requestJson(baseUrl, 'GET', '/api-spec.json');
      if (jsonRes.status !== 200) fail(`GET /api-spec.json expected 200, got ${jsonRes.status}`);
      else if (!jsonRes.json || !jsonRes.json.openapi) fail('OpenAPI JSON missing `openapi` field');
      else ok('GET /api-spec.json');
    }

    // Login as ADMIN
    let adminToken = null;
    {
      const res = await requestJson(baseUrl, 'POST', '/api/v1/auth/login', {
        body: { username: 'admin', password: 'Admin@1234' },
      });
      if (res.status !== 200 || !res.json || !res.json.data.token) {
        fail(`ADMIN login failed (status ${res.status})`);
      } else {
        adminToken = res.json.data.token;
        ok('POST /api/v1/auth/login (ADMIN)');
      }
    }

    // ADMIN protected endpoints
    {
      const me = await requestJson(baseUrl, 'GET', '/api/v1/auth/me', { token: adminToken });
      if (me.status !== 200 || !me.json || me.json.status !== 'success') fail('ADMIN GET /api/v1/auth/me failed');
      else ok('GET /api/v1/auth/me (ADMIN)');

      const provinces = await requestJson(baseUrl, 'GET', '/api/v1/provinces', { token: adminToken });
      if (provinces.status !== 200 || !provinces.json || provinces.json.status !== 'success') fail('ADMIN GET /api/v1/provinces failed');
      else ok('GET /api/v1/provinces (ADMIN)');

      const vehicles = await requestJson(baseUrl, 'GET', '/api/v1/vehicles?limit=1', { token: adminToken });
      if (vehicles.status !== 200 || !vehicles.json || vehicles.json.status !== 'success') fail('ADMIN GET /api/v1/vehicles failed');
      else ok('GET /api/v1/vehicles (ADMIN)');
    }

    // Login as DEVICE and push a location
    let deviceToken = null;
    let vehicleId = null;
    {
      const res = await requestJson(baseUrl, 'POST', '/api/v1/auth/login', {
        body: { username: 'device_dev-0001', password: 'Device@5678' },
      });
      if (res.status !== 200 || !res.json || !res.json.data.token) {
        fail(`DEVICE login failed (status ${res.status})`);
      } else {
        deviceToken = res.json.data.token;
        ok('POST /api/v1/auth/login (DEVICE)');

        const payload = decodeJwtPayload(deviceToken);
        vehicleId = payload && payload.vehicleId;
        if (!vehicleId) fail('DEVICE token payload missing vehicle_id');
        else ok(`Decoded DEVICE vehicle_id=${vehicleId}`);
      }
    }

    const testLat = 6.9271;
    const testLng = 79.8612;

    {
      const push = await requestJson(baseUrl, 'POST', '/api/v1/locations', {
        token: deviceToken,
        body: {
          vehicleId: vehicleId,
          latitude: testLat,
          longitude: testLng,
          speed: 12.3,
          heading: 90,
          accuracy: 5.2,
        },
      });

      if (push.status !== 201 || !push.json || push.json.status !== 'success') {
        fail(`DEVICE POST /api/v1/locations expected 201, got ${push.status}`);
      } else {
        ok('POST /api/v1/locations (DEVICE)');
      }
    }

    // Verify that the pushed ping is now the latest for that vehicle
    {
      const last = await requestJson(baseUrl, 'GET', `/api/v1/vehicles/${vehicleId}/location`, { token: adminToken });
      const loc = last.json && last.json.data && last.json.data.location;

      const closeEnough = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;

      if (last.status !== 200 || !loc) {
        fail(`ADMIN GET /api/v1/vehicles/${vehicleId}/location failed (status ${last.status})`);
      } else if (!closeEnough(loc.coordinates.latitude, testLat) || !closeEnough(loc.coordinates.longitude, testLng)) {
        fail(`Last location does not match. Expected ${testLat},${testLng} but got ${loc.coordinates.latitude},${loc.coordinates.longitude}`);
      } else {
        ok('GET /api/v1/vehicles/:id/location reflects latest device ping');
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
