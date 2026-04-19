// controllers/geoController.js

const { query, run, queryOne } = require('../db/database');

// ── PROVINCES ─────────────────────────────────────────────────────────────────

function getProvinces(req, res) {
  try {
    const provinces = query(`
      SELECT p.*, COUNT(d.id) AS district_count
      FROM provinces p
      LEFT JOIN districts d ON d.province_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
    return res.status(200).json({ success: true, count: provinces.length, data: provinces });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function getProvinceById(req, res) {
  try {
    const province = queryOne('SELECT * FROM provinces WHERE id = ?', [req.params.id]);
    if (!province) return res.status(404).json({ success: false, message: 'Province not found.' });

    const districts = query('SELECT * FROM districts WHERE province_id = ? ORDER BY name', [req.params.id]);
    return res.status(200).json({ success: true, data: { ...province, districts } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function createProvince(req, res) {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'name and code are required.' });
    const id = run('INSERT INTO provinces (name, code) VALUES (?, ?)', [name, code.toUpperCase()]);
    return res.status(201).json({ success: true, data: { id, name, code: code.toUpperCase() } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'Province code already exists.' });
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// ── DISTRICTS ─────────────────────────────────────────────────────────────────

function getDistricts(req, res) {
  try {
    const { province_id, sort } = req.query;
    let sql    = 'SELECT d.*, p.name AS province_name, p.code AS province_code FROM districts d JOIN provinces p ON d.province_id = p.id';
    let params = [];

    if (province_id) { sql += ' WHERE d.province_id = ?'; params.push(province_id); }

    const allowedSort = ['name', 'code', 'created_at'];
    const [field, dir] = (sort || 'name:asc').split(':');
    sql += ` ORDER BY d.${allowedSort.includes(field) ? field : 'name'} ${dir === 'desc' ? 'DESC' : 'ASC'}`;

    const districts = query(sql, params);
    return res.status(200).json({ success: true, count: districts.length, data: districts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function getDistrictById(req, res) {
  try {
    const district = queryOne(
      'SELECT d.*, p.name AS province_name FROM districts d JOIN provinces p ON d.province_id = p.id WHERE d.id = ?',
      [req.params.id]
    );
    if (!district) return res.status(404).json({ success: false, message: 'District not found.' });

    const stations = query('SELECT * FROM stations WHERE district_id = ? ORDER BY name', [req.params.id]);
    return res.status(200).json({ success: true, data: { ...district, stations } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function createDistrict(req, res) {
  try {
    const { name, code, province_id } = req.body;
    if (!name || !code || !province_id) return res.status(400).json({ success: false, message: 'name, code and province_id are required.' });

    const province = queryOne('SELECT id FROM provinces WHERE id = ?', [province_id]);
    if (!province) return res.status(404).json({ success: false, message: 'Province not found.' });

    const id = run('INSERT INTO districts (name, code, province_id) VALUES (?, ?, ?)', [name, code.toUpperCase(), province_id]);
    return res.status(201).json({ success: true, data: { id, name, code: code.toUpperCase(), province_id } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'District code already exists.' });
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// ── STATIONS ──────────────────────────────────────────────────────────────────

function getStations(req, res) {
  try {
    const { district_id, province_id } = req.query;
    let conditions = [];
    let params     = [];
    if (district_id)  { conditions.push('s.district_id = ?');  params.push(district_id);  }
    if (province_id) { conditions.push('s.province_id = ?'); params.push(province_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const stations = query(`
      SELECT s.*, d.name AS district_name, p.name AS province_name
      FROM stations s
      JOIN districts  d ON s.district_id = d.id
      JOIN provinces  p ON s.province_id = p.id
      ${where}
      ORDER BY s.name ASC
    `, params);

    return res.status(200).json({ success: true, count: stations.length, data: stations });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function getStationById(req, res) {
  try {
    const station = queryOne(`
      SELECT s.*, d.name AS district_name, p.name AS province_name
      FROM stations s
      JOIN districts d ON s.district_id = d.id
      JOIN provinces p ON s.province_id = p.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!station) return res.status(404).json({ success: false, message: 'Station not found.' });

    const vehicles = query(
      'SELECT id, registration_number, make, model, status FROM vehicles WHERE station_id = ? LIMIT 20',
      [req.params.id]
    );
    return res.status(200).json({ success: true, data: { ...station, vehicles } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

function createStation(req, res) {
  try {
    const { name, code, district_id, province_id, address, phone } = req.body;
    if (!name || !district_id || !province_id) {
      return res.status(400).json({ success: false, message: 'name, district_id and province_id are required.' });
    }
    const id = run(
      'INSERT INTO stations (name, code, district_id, province_id, address, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code || null, district_id, province_id, address || null, phone || null]
    );
    return res.status(201).json({ success: true, data: { id, name } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = {
  getProvinces, getProvinceById, createProvince,
  getDistricts, getDistrictById, createDistrict,
  getStations,  getStationById,  createStation,
};
