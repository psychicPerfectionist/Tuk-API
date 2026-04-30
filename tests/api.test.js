/**
 * TEST SUITE — Sri Lanka Police Tuk-Tuk Tracking API
 *
 * Covers: authentication, role-based access control, vehicle CRUD,
 * location push and query, driver endpoints, sorting, filtering,
 * input validation, and security headers.
 */

require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const app     = require('../src/app');
const bcrypt  = require('bcryptjs');
const { dbAsync } = require('../src/config/database');

// ── Shared state ──────────────────────────────────────────────────────────────
let adminToken, provincialToken, districtToken, deviceToken;
let testProvinceId, testDistrictId, testStationId;
let testVehicleId, testDeviceVehicleId, testDriverId;

// ── Setup: seed minimal test data ─────────────────────────────────────────────
beforeAll(async () => {
  for (const col of ['users','provinces','districts','stations','vehicles','drivers','locations']) {
    await dbAsync[col].remove({}, { multi: true });
  }

  const pw  = await bcrypt.hash('Admin@1234', 10);
  const dpw = await bcrypt.hash('Device@5678', 10);

  const prov = await dbAsync.provinces.insert({
    name: 'Western Province', code: 'WP',
    sinhaleName: 'test', tamilName: 'test',
    coordinates: { latitude: 6.9271, longitude: 79.8612 },
    createdAt: new Date().toISOString(),
  });
  testProvinceId = prov._id;

  const dist = await dbAsync.districts.insert({
    name: 'Colombo', code: 'CMB', provinceId: testProvinceId,
    coordinates: { latitude: 6.9271, longitude: 79.8612 },
    createdAt: new Date().toISOString(),
  });
  testDistrictId = dist._id;

  const station = await dbAsync.stations.insert({
    name: 'Colombo Fort', code: 'COF',
    districtId: testDistrictId, provinceId: testProvinceId,
    stationType: 'STATION', isActive: true,
    createdAt: new Date().toISOString(),
  });
  testStationId = station._id;

  const driver = await dbAsync.drivers.insert({
    fullName: 'Kamal Perera', licenseNumber: 'B1234567',
    nicNumber: '198512345678V', status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });
  testDriverId = driver._id;

  const vehicle = await dbAsync.vehicles.insert({
    registrationNumber: 'WPCAB0001', deviceId: 'DEV-0001',
    deviceImei: '123456789012345', make: 'Bajaj', model: 'RE',
    colour: 'Yellow', yearOfRegistration: 2020,
    engineNumber: 'ENG123456', chassisNumber: 'CHS987654',
    driverId: testDriverId, stationId: testStationId,
    provinceId: testProvinceId, districtId: testDistrictId,
    status: 'ACTIVE', createdAt: new Date().toISOString(),
  });
  testVehicleId = vehicle._id;

  const devVehicle = await dbAsync.vehicles.insert({
    registrationNumber: 'WPCAB0002', deviceId: 'DEV-0002',
    make: 'TVS', model: 'King', colour: 'Yellow',
    provinceId: testProvinceId, districtId: testDistrictId,
    status: 'ACTIVE', createdAt: new Date().toISOString(),
  });
  testDeviceVehicleId = devVehicle._id;

  // Location pings
  for (let i = 0; i < 5; i++) {
    const t = new Date(Date.now() - i * 60000).toISOString();
    await dbAsync.locations.insert({
      vehicleId: testVehicleId,
      latitude: 6.9271 + i * 0.001, longitude: 79.8612 + i * 0.001,
      speed: 30, heading: 180, accuracy: 5, satellites: 8,
      timestamp: t, receivedAt: t,
    });
  }

  await dbAsync.users.insert({ username: 'admin', passwordHash: pw, fullName: 'Admin', role: 'ADMIN', isActive: true, createdAt: new Date().toISOString() });
  await dbAsync.users.insert({ username: 'wp_officer', passwordHash: pw, fullName: 'WP Officer', role: 'PROVINCIAL', provinceId: testProvinceId, isActive: true, createdAt: new Date().toISOString() });
  await dbAsync.users.insert({ username: 'cmb_officer', passwordHash: pw, fullName: 'CMB Officer', role: 'DISTRICT', districtId: testDistrictId, provinceId: testProvinceId, isActive: true, createdAt: new Date().toISOString() });
  await dbAsync.users.insert({ username: 'device_001', passwordHash: dpw, fullName: 'Device 001', role: 'DEVICE', vehicleId: testDeviceVehicleId, isActive: true, createdAt: new Date().toISOString() });

  const r1 = await request(app).post('/api/v1/auth/login').send({ username: 'admin',       password: 'Admin@1234' });
  const r2 = await request(app).post('/api/v1/auth/login').send({ username: 'wp_officer',  password: 'Admin@1234' });
  const r3 = await request(app).post('/api/v1/auth/login').send({ username: 'cmb_officer', password: 'Admin@1234' });
  const r4 = await request(app).post('/api/v1/auth/login').send({ username: 'device_001',  password: 'Device@5678' });

  adminToken      = r1.body.data.token;
  provincialToken = r2.body.data.token;
  districtToken   = r3.body.data.token;
  deviceToken     = r4.body.data.token;
}, 30000);

afterAll(async () => {
  for (const col of ['users','provinces','districts','stations','vehicles','drivers','locations']) {
    await dbAsync[col].remove({}, { multi: true });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/login', () => {
  test('200 with JWT token on valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  test('401 on wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  test('422 when password missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('password');
  });

  test('401 for non-existent user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'nobody', password: 'Admin@1234' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  test('200 returns profile without passwordHash', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('admin');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROVINCES
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/provinces', () => {
  test('200 returns provinces with districtCount and href', async () => {
    const res = await request(app).get('/api/v1/provinces').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('districtCount');
    expect(res.body.data[0]).toHaveProperty('href');
  });

  test('supports ?sort=name:asc', async () => {
    const res = await request(app).get('/api/v1/provinces?sort=name:asc').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('422 on invalid sort format', async () => {
    const res = await request(app).get('/api/v1/provinces?sort=badformat').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });

  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/provinces');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VEHICLES
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/vehicles', () => {
  test('200 with pagination meta', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('totalPages');
  });

  test('resource model: id not _id, href present, deviceImei absent', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`);
    const v = res.body.data[0];
    expect(v.id).toBeDefined();
    expect(v._id).toBeUndefined();
    expect(v.href).toBeDefined();
    expect(v.deviceImei).toBeUndefined();
  });

  test('filters by provinceId', async () => {
    const res = await request(app).get(`/api/v1/vehicles?provinceId=${testProvinceId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('sorts by registrationNumber:asc', async () => {
    const res = await request(app).get('/api/v1/vehicles?sort=registrationNumber:asc').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('sorts by status:desc', async () => {
    const res = await request(app).get('/api/v1/vehicles?sort=status:desc').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('DISTRICT officer only sees own district', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${districtToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(v => {
      if (v.district) expect(v.district.id).toBe(testDistrictId);
    });
  });

  test('403 for DEVICE role', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${deviceToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/vehicles/:id', () => {
  test('ADMIN sees engineNumber and chassisNumber', async () => {
    const res = await request(app).get(`/api/v1/vehicles/${testVehicleId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.engineNumber).toBeDefined();
    expect(res.body.data.chassisNumber).toBeDefined();
  });

  test('DISTRICT cannot see engineNumber or chassisNumber', async () => {
    const res = await request(app).get(`/api/v1/vehicles/${testVehicleId}`).set('Authorization', `Bearer ${districtToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.engineNumber).toBeUndefined();
    expect(res.body.data.chassisNumber).toBeUndefined();
  });

  test('registeredAt field present (not createdAt)', async () => {
    const res = await request(app).get(`/api/v1/vehicles/${testVehicleId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.registeredAt).toBeDefined();
    expect(res.body.data.createdAt).toBeUndefined();
  });

  test('404 for non-existent vehicle', async () => {
    const res = await request(app).get('/api/v1/vehicles/nonexistent999').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/vehicles', () => {
  test('201 creates vehicle with valid data', async () => {
    const res = await request(app).post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ registrationNumber: 'WP-TEST-001', deviceId: 'DEV-TEST-001', make: 'Bajaj', provinceId: testProvinceId, districtId: testDistrictId });
    expect(res.status).toBe(201);
  });

  test('422 when registrationNumber missing', async () => {
    const res = await request(app).post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 'DEV-TEST-002' });
    expect(res.status).toBe(422);
  });

  test('403 DISTRICT cannot create vehicle', async () => {
    const res = await request(app).post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${districtToken}`)
      .send({ registrationNumber: 'WP-TEST-002', deviceId: 'DEV-TEST-003' });
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOCATIONS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/vehicles/:id/location', () => {
  test('returns nested coordinates and telemetry', async () => {
    const res = await request(app).get(`/api/v1/vehicles/${testVehicleId}/location`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.location.coordinates).toBeDefined();
    expect(res.body.data.location.telemetry).toBeDefined();
    expect(res.body.data.location.timestamp).toBeDefined();
    expect(res.body.data.location.receivedAt).toBeDefined();
  });

  test('404 when no location data exists', async () => {
    const empty = await dbAsync.vehicles.insert({ registrationNumber: 'EMPTY001', deviceId: 'EMPTY-DEV', status: 'ACTIVE', createdAt: new Date().toISOString() });
    const res = await request(app).get(`/api/v1/vehicles/${empty._id}/location`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    await dbAsync.vehicles.remove({ _id: empty._id });
  });
});

describe('GET /api/v1/vehicles/:id/history', () => {
  test('returns pings within time window', async () => {
    const from = new Date(Date.now() - 3600000).toISOString();
    const res  = await request(app).get(`/api/v1/vehicles/${testVehicleId}/history?from=${from}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.history)).toBe(true);
  });

  test('400 when from is after to', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${testVehicleId}/history?from=2026-04-20T00:00:00Z&to=2026-04-19T00:00:00Z`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('422 on invalid date format', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${testVehicleId}/history?from=not-a-date`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/locations', () => {
  test('201 DEVICE pushes valid ping', async () => {
    const res = await request(app).post('/api/v1/locations')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ vehicleId: testDeviceVehicleId, latitude: 6.9271, longitude: 79.8612, speed: 30, heading: 180 });
    expect(res.status).toBe(201);
    expect(res.body.data.pingId).toBeDefined();
  });

  test('422 when latitude missing', async () => {
    const res = await request(app).post('/api/v1/locations')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ vehicleId: testDeviceVehicleId, longitude: 79.8612 });
    expect(res.status).toBe(422);
    expect(res.body.errors.some(e => e.field === 'latitude')).toBe(true);
  });

  test('422 for out-of-range coordinates', async () => {
    const res = await request(app).post('/api/v1/locations')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ vehicleId: testDeviceVehicleId, latitude: 999, longitude: 79.8612 });
    expect(res.status).toBe(422);
  });

  test('403 DEVICE cannot push for different vehicle', async () => {
    const res = await request(app).post('/api/v1/locations')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ vehicleId: testVehicleId, latitude: 6.9271, longitude: 79.8612 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/locations/live', () => {
  test('returns active vehicles with asOf timestamp', async () => {
    const res = await request(app).get('/api/v1/locations/live').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('asOf');
    expect(res.body.meta).toHaveProperty('total');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DRIVERS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/drivers', () => {
  test('nicNumber NOT in list items', async () => {
    const res = await request(app).get('/api/v1/drivers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(d => expect(d.nicNumber).toBeUndefined());
  });

  test('supports ?sort=fullName:asc', async () => {
    const res = await request(app).get('/api/v1/drivers?sort=fullName:asc').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/drivers/:id', () => {
  test('ADMIN sees nicNumber in detail', async () => {
    const res = await request(app).get(`/api/v1/drivers/${testDriverId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nicNumber).toBeDefined();
  });

  test('DISTRICT officer cannot see nicNumber', async () => {
    const res = await request(app).get(`/api/v1/drivers/${testDriverId}`).set('Authorization', `Bearer ${districtToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nicNumber).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY
// ══════════════════════════════════════════════════════════════════════════════
describe('Security', () => {
  test('401 with malformed token', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', 'Bearer notvalid.jwt.token');
    expect(res.status).toBe(401);
  });

  test('401 with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/vehicles');
    expect(res.status).toBe(401);
  });

  test('404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/doesnotexist').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('X-Request-ID header present on every response', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('passwordHash never leaks in any response', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });

  test('deviceImei never appears in vehicle responses', async () => {
    const res = await request(app).get('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(JSON.stringify(res.body)).not.toContain('deviceImei');
  });
});
