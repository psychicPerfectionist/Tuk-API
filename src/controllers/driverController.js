// controllers/driverController.js

const { query, run, queryOne } = require('../db/database');

function getAllDrivers(req, res) {
  try {
    const { status, sort, page = 1, limit = 20 } = req.query;
    let sql    = 'SELECT id, full_name, license_number, phone, status, created_at FROM drivers';
    let params = [];

    if (status) { sql += ' WHERE status = ?'; params.push(status); }

    const allowedSort = ['full_name', 'license_number', 'status', 'created_at'];
    const [field, dir] = (sort || 'full_name:asc').split(':');
    sql += ` ORDER BY ${allowedSort.includes(field) ? field : 'full_name'} ${dir === 'desc' ? 'DESC' : 'ASC'}`;

    const pageNum  = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * pageSize;

    const countRes = query(`SELECT COUNT(*) as total FROM drivers ${status ? 'WHERE status = ?' : ''}`, status ? [status] : []);
    const total    = countRes[0] ? countRes[0].total : 0;

    const drivers = query(sql + ` LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    // Note: nic_number is NOT included in list view — only in detail
    return res.status(200).json({
      success: true,
      data: drivers,
      meta: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function getDriverById(req, res) {
  try {
    const driver = queryOne('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    // NIC is sensitive - only ADMIN and PROVINCIAL can see it
    if (req.user.role === 'DISTRICT') {
      delete driver.nic_number;
    }

    const vehicles = query(
      'SELECT id, registration_number, make, model, status FROM vehicles WHERE driver_id = ?',
      [req.params.id]
    );
    return res.status(200).json({ success: true, data: { ...driver, vehicles } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function createDriver(req, res) {
  try {
    const { full_name, license_number, nic_number, phone } = req.body;
    if (!full_name || !license_number || !nic_number) {
      return res.status(400).json({ success: false, message: 'full_name, license_number and nic_number are required.' });
    }
    const id = run(
      'INSERT INTO drivers (full_name, license_number, nic_number, phone) VALUES (?, ?, ?, ?)',
      [full_name, license_number, nic_number, phone || null]
    );
    return res.status(201).json({ success: true, data: { id, full_name, license_number } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'License number or NIC already exists.' });
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function updateDriver(req, res) {
  try {
    const { phone, status } = req.body;
    run(
      'UPDATE drivers SET phone = COALESCE(?, phone), status = COALESCE(?, status) WHERE id = ?',
      [phone || null, status || null, req.params.id]
    );
    return res.status(200).json({ success: true, message: 'Driver updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = { getAllDrivers, getDriverById, createDriver, updateDriver };
