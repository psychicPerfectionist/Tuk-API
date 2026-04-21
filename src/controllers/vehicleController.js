// controllers/vehicleController.js

const { query, run, queryOne } = require('../db/database');

// GET /api/vehicles
// Supports ?province_id=, ?district_id=, ?status=, ?sort=, ?page=, ?limit=
function getAllVehicles(req, res) {
  try {
    const { province_id, district_id, station_id, status, sort, page = 1, limit = 20 } = req.query;

    // Build the WHERE clause based on filters
    let conditions = [];
    let params     = [];

    // Scope by role - provincial officers only see their province
    if (req.user.role === 'PROVINCIAL' && req.user.province_id) {
      conditions.push('v.province_id = ?');
      params.push(req.user.province_id);
    } else if (req.user.role === 'DISTRICT' && req.user.district_id) {
      conditions.push('v.district_id = ?');
      params.push(req.user.district_id);
    }

    // Apply query filters
    if (province_id) { conditions.push('v.province_id = ?'); params.push(province_id); }
    if (district_id)  { conditions.push('v.district_id = ?');  params.push(district_id);  }
    if (station_id)  { conditions.push('v.station_id = ?');  params.push(station_id);  }
    if (status)      { conditions.push('v.status = ?');       params.push(status);       }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Sorting
    const allowedSortFields = ['registration_number', 'make', 'status', 'created_at'];
    let orderBy = 'v.registration_number ASC';
    if (sort) {
      const [field, dir] = sort.split(':');
      if (allowedSortFields.includes(field)) {
        orderBy = `v.${field} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
      }
    }

    // Pagination
    const pageNum  = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * pageSize;

    // Count total for pagination meta
    const countResult = query(`SELECT COUNT(*) as total FROM vehicles v ${where}`, params);
    const total = countResult[0] ? countResult[0].total : 0;

    // Get vehicles with province and district names joined
    const vehicles = query(`
      SELECT
        v.id,
        v.registration_number,
        v.device_id,
        v.make,
        v.model,
        v.colour,
        v.status,
        v.created_at,
        d.full_name  AS driver_name,
        p.name       AS province_name,
        p.code       AS province_code,
        dist.name    AS district_name,
        s.name       AS station_name,
        (SELECT latitude  FROM location_pings WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1) AS last_lat,
        (SELECT longitude FROM location_pings WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1) AS last_lng,
        (SELECT pinged_at FROM location_pings WHERE vehicle_id = v.id ORDER BY id DESC LIMIT 1) AS last_seen
      FROM vehicles v
      LEFT JOIN drivers   d    ON v.driver_id   = d.id
      LEFT JOIN provinces p    ON v.province_id = p.id
      LEFT JOIN districts dist ON v.district_id = dist.id
      LEFT JOIN stations  s    ON v.station_id  = s.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return res.status(200).json({
      success: true,
      data:    vehicles,
      meta: {
        total,
        page:       pageNum,
        limit:      pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });

  } catch (err) {
    console.error('getAllVehicles error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/vehicles/:id
function getVehicleById(req, res) {
  try {
    const vehicle = queryOne(`
      SELECT
        v.*,
        d.full_name     AS driver_name,
        d.license_number AS driver_license,
        d.phone          AS driver_phone,
        p.name           AS province_name,
        dist.name        AS district_name,
        s.name           AS station_name,
        s.phone          AS station_phone
      FROM vehicles v
      LEFT JOIN drivers   d    ON v.driver_id   = d.id
      LEFT JOIN provinces p    ON v.province_id = p.id
      LEFT JOIN districts dist ON v.district_id = dist.id
      LEFT JOIN stations  s    ON v.station_id  = s.id
      WHERE v.id = ?
    `, [req.params.id]);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    // Check jurisdiction
    if (req.user.role === 'PROVINCIAL' && req.user.province_id && vehicle.province_id != req.user.province_id) {
      return res.status(403).json({ success: false, message: 'This vehicle is outside your province.' });
    }
    if (req.user.role === 'DISTRICT' && req.user.district_id && vehicle.district_id != req.user.district_id) {
      return res.status(403).json({ success: false, message: 'This vehicle is outside your district.' });
    }

    return res.status(200).json({ success: true, data: vehicle });

  } catch (err) {
    console.error('getVehicleById error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// POST /api/vehicles
function createVehicle(req, res) {
  try {
    const { registration_number, device_id, make, model, colour, driver_id, station_id, province_id, district_id } = req.body;

    if (!registration_number || !device_id) {
      return res.status(400).json({ success: false, message: 'registration_number and device_id are required.' });
    }

    const id = run(
      `INSERT INTO vehicles (registration_number, device_id, make, model, colour, driver_id, station_id, province_id, district_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [registration_number.toUpperCase(), device_id, make || null, model || null, colour || null,
       driver_id || null, station_id || null, province_id || null, district_id || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully.',
      data:    { id, registration_number, device_id },
    });

  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'Registration number or device ID already exists.' });
    }
    console.error('createVehicle error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// PATCH /api/vehicles/:id
function updateVehicle(req, res) {
  try {
    const vehicle = queryOne('SELECT id FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    const { make, model, colour, driver_id, station_id, province_id, district_id, status } = req.body;

    run(
      `UPDATE vehicles SET
        make        = COALESCE(?, make),
        model       = COALESCE(?, model),
        colour      = COALESCE(?, colour),
        driver_id   = COALESCE(?, driver_id),
        station_id  = COALESCE(?, station_id),
        province_id = COALESCE(?, province_id),
        district_id  = COALESCE(?, district_id),
        status      = COALESCE(?, status)
       WHERE id = ?`,
      [make || null, model || null, colour || null, driver_id || null,
       station_id || null, province_id || null, district_id || null, status || null, req.params.id]
    );

    return res.status(200).json({ success: true, message: 'Vehicle updated.' });

  } catch (err) {
    console.error('updateVehicle error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// DELETE /api/vehicles/:id  (soft delete - just changes status)
function deleteVehicle(req, res) {
  try {
    const n = run("UPDATE vehicles SET status = 'DEREGISTERED' WHERE id = ?", [req.params.id]);
    if (!n) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('deleteVehicle error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/vehicles/:id/location  - last known position
function getLastLocation(req, res) {
  try {
    const vehicle = queryOne('SELECT id, registration_number, status FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    const location = queryOne(
      'SELECT * FROM location_pings WHERE vehicle_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id]
    );

    if (!location) {
      return res.status(404).json({ success: false, message: 'No location data available for this vehicle yet.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        vehicle:  { id: vehicle.id, registration_number: vehicle.registration_number },
        location: {
          latitude:  location.latitude,
          longitude: location.longitude,
          speed:     location.speed,
          heading:   location.heading,
          pinged_at: location.pinged_at,
        },
      },
    });

  } catch (err) {
    console.error('getLastLocation error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/vehicles/:id/history  - movement log with time window
function getLocationHistory(req, res) {
  try {
    const vehicle = queryOne('SELECT id, registration_number FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    const { from, to, limit = 1000 } = req.query;

    // Default: last 24 hours
    const toDate   = to   ? new Date(to)   : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use ISO 8601 format e.g. 2026-04-20T00:00:00Z' });
    }

    if (fromDate >= toDate) {
      return res.status(400).json({ success: false, message: '"from" must be before "to".' });
    }

    const maxPoints = Math.min(parseInt(limit), 5000);

    const history = query(
      `SELECT latitude, longitude, speed, heading, accuracy, pinged_at
       FROM location_pings
       WHERE vehicle_id = ? AND pinged_at >= ? AND pinged_at <= ?
       ORDER BY pinged_at ASC
       LIMIT ?`,
      [req.params.id, fromDate.toISOString(), toDate.toISOString(), maxPoints]
    );

    return res.status(200).json({
      success: true,
      data: {
        vehicle: { id: vehicle.id, registration_number: vehicle.registration_number },
        window:  { from: fromDate.toISOString(), to: toDate.toISOString() },
        count:   history.length,
        history,
      },
    });

  } catch (err) {
    console.error('getLocationHistory error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getLastLocation,
  getLocationHistory,
};
