// routes/index.js
// All API routes defined in one place - easy to read and follow

const express = require('express');
const router  = express.Router();

const { protect, allowRoles } = require('../middleware/auth');

const auth     = require('../controllers/authController');
const vehicles = require('../controllers/vehicleController');
const locations = require('../controllers/locationController');
const geo      = require('../controllers/geoController');
const drivers  = require('../controllers/driverController');

// ── AUTH (no token needed for login) ──────────────────────────────────────────
router.post('/auth/login',    auth.login);
router.post('/auth/register', protect, allowRoles('ADMIN'), auth.register);
router.get ('/auth/me',       protect, auth.me);

// ── PROVINCES ─────────────────────────────────────────────────────────────────
router.get ('/provinces',     protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getProvinces);
router.post('/provinces',     protect, allowRoles('ADMIN'), geo.createProvince);
router.get ('/provinces/:id', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getProvinceById);

// ── DISTRICTS ─────────────────────────────────────────────────────────────────
router.get ('/districts',     protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getDistricts);
router.post('/districts',     protect, allowRoles('ADMIN'), geo.createDistrict);
router.get ('/districts/:id', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getDistrictById);

// ── STATIONS ──────────────────────────────────────────────────────────────────
router.get ('/stations',     protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getStations);
router.post('/stations',     protect, allowRoles('ADMIN', 'PROVINCIAL'), geo.createStation);
router.get ('/stations/:id', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), geo.getStationById);

// ── VEHICLES ──────────────────────────────────────────────────────────────────
router.get   ('/vehicles',              protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), vehicles.getAllVehicles);
router.post  ('/vehicles',              protect, allowRoles('ADMIN', 'PROVINCIAL'), vehicles.createVehicle);
router.get   ('/vehicles/:id',          protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), vehicles.getVehicleById);
router.patch ('/vehicles/:id',          protect, allowRoles('ADMIN', 'PROVINCIAL'), vehicles.updateVehicle);
router.delete('/vehicles/:id',          protect, allowRoles('ADMIN'), vehicles.deleteVehicle);
router.get   ('/vehicles/:id/location', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), vehicles.getLastLocation);
router.get   ('/vehicles/:id/history',  protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), vehicles.getLocationHistory);

// ── LOCATIONS ─────────────────────────────────────────────────────────────────
// live must come before /:id style routes
router.get ('/locations/live', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), locations.getLiveView);
router.post('/locations',      protect, allowRoles('DEVICE', 'ADMIN', 'PROVINCIAL', 'DISTRICT'), locations.pushLocation);
router.get ('/locations',      protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), locations.getLocations);

// ── DRIVERS ───────────────────────────────────────────────────────────────────
router.get  ('/drivers',     protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), drivers.getAllDrivers);
router.post ('/drivers',     protect, allowRoles('ADMIN', 'PROVINCIAL'), drivers.createDriver);
router.get  ('/drivers/:id', protect, allowRoles('ADMIN', 'PROVINCIAL', 'DISTRICT'), drivers.getDriverById);
router.patch('/drivers/:id', protect, allowRoles('ADMIN', 'PROVINCIAL'), drivers.updateDriver);

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Tuk-Tuk Tracking API',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
