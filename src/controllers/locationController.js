// controllers/locationController.js

const { query, run, queryOne } = require('../db/database');

// POST /api/locations  - GPS device pushes a ping
function pushLocation(req, res) {
  try {
    const { vehicle_id, latitude, longitude, speed, heading, accuracy } = req.body;

    if (!vehicle_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'vehicle_id, latitude and longitude are required.' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates.' });
    }

    // Sri Lanka boundary check
    if (lat < 5.7 || lat > 10.0 || lng < 79.4 || lng > 82.0) {
      return res.status(422).json({ success: false, message: 'Coordinates are outside Sri Lanka.' });
    }

    const vehicle = queryOne('SELECT id, status FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }
    if (vehicle.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Vehicle is not active.' });
    }

    // Device tokens can only push for their own vehicle
    if (req.user.role === 'DEVICE' && req.user.vehicle_id != vehicle_id) {
      return res.status(403).json({ success: false, message: 'This device is not linked to that vehicle.' });
    }

    // Always store ISO timestamps to keep ordering consistent with seeded data
    const pingedAt = new Date().toISOString();

    const pingId = run(
      'INSERT INTO location_pings (vehicle_id, latitude, longitude, speed, heading, accuracy, pinged_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vehicle_id, lat, lng, speed || null, heading || null, accuracy || null, pingedAt]
    );

    return res.status(201).json({
      success:   true,
      message:   'Location recorded.',
      ping_id:   pingId,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('pushLocation error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/locations/live  - latest ping for every active vehicle
function getLiveView(req, res) {
  try {
    const { province_id, district_id } = req.query;

    let conditions = ["v.status = 'ACTIVE'"];
    let params     = [];

    // Scope by role
    if (req.user.role === 'PROVINCIAL' && req.user.province_id) {
      conditions.push('v.province_id = ?');
      params.push(req.user.province_id);
    } else if (req.user.role === 'DISTRICT' && req.user.district_id) {
      conditions.push('v.district_id = ?');
      params.push(req.user.district_id);
    }

    if (province_id) { conditions.push('v.province_id = ?'); params.push(province_id); }
    if (district_id)  { conditions.push('v.district_id = ?');  params.push(district_id);  }

    const where = 'WHERE ' + conditions.join(' AND ');

    // Get the latest ping for each vehicle using a subquery
    const liveData = query(`
      SELECT
        v.id                  AS vehicle_id,
        v.registration_number,
        v.make,
        v.colour,
        d.full_name           AS driver,
        p.name                AS province,
        dist.name             AS district,
        lp.latitude,
        lp.longitude,
        lp.speed,
        lp.pinged_at          AS last_seen
      FROM vehicles v
      LEFT JOIN drivers   d    ON v.driver_id   = d.id
      LEFT JOIN provinces p    ON v.province_id = p.id
      LEFT JOIN districts dist ON v.district_id = dist.id
      LEFT JOIN location_pings lp ON lp.id = (
        SELECT id FROM location_pings
        WHERE vehicle_id = v.id
        ORDER BY id DESC
        LIMIT 1
      )
      ${where}
      AND lp.id IS NOT NULL
      ORDER BY lp.pinged_at DESC
    `, params);

    return res.status(200).json({
      success: true,
      count:   liveData.length,
      as_of:   new Date().toISOString(),
      data:    liveData,
    });

  } catch (err) {
    console.error('getLiveView error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/locations  - filtered historical query
function getLocations(req, res) {
  try {
    const { vehicle_id, province_id, district_id, from, to, page = 1, limit = 50 } = req.query;

    let conditions = [];
    let params     = [];

    if (vehicle_id)  { conditions.push('lp.vehicle_id = ?');   params.push(vehicle_id);  }
    if (province_id) { conditions.push('v.province_id = ?');   params.push(province_id); }
    if (district_id)  { conditions.push('v.district_id = ?');   params.push(district_id);  }
    if (from)        { conditions.push('lp.pinged_at >= ?');    params.push(from);         }
    if (to)          { conditions.push('lp.pinged_at <= ?');    params.push(to);           }

    // Scope by role
    if (req.user.role === 'PROVINCIAL' && req.user.province_id) {
      conditions.push('v.province_id = ?');
      params.push(req.user.province_id);
    } else if (req.user.role === 'DISTRICT' && req.user.district_id) {
      conditions.push('v.district_id = ?');
      params.push(req.user.district_id);
    }

    const where    = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const pageNum  = Math.max(1, parseInt(page));
    const pageSize = Math.min(500, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * pageSize;

    const countResult = query(
      `SELECT COUNT(*) as total FROM location_pings lp JOIN vehicles v ON lp.vehicle_id = v.id ${where}`,
      params
    );
    const total = countResult[0] ? countResult[0].total : 0;

    const pings = query(`
      SELECT
        lp.id, lp.vehicle_id, v.registration_number,
        lp.latitude, lp.longitude, lp.speed, lp.heading, lp.pinged_at
      FROM location_pings lp
      JOIN vehicles v ON lp.vehicle_id = v.id
      ${where}
      ORDER BY lp.id DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return res.status(200).json({
      success: true,
      data:    pings,
      meta: {
        total,
        page:       pageNum,
        limit:      pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });

  } catch (err) {
    console.error('getLocations error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = { pushLocation, getLiveView, getLocations };
