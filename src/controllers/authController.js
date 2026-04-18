// controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query, run, queryOne } = require('../db/database');

// POST /api/auth/login
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Find user by username
    const user = queryOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username.toLowerCase()]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Check password
    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id:          user.id,
        username:    user.username,
        role:        user.role,
        province_id: user.province_id,
        district_id: user.district_id,
        vehicle_id:  user.vehicle_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Don't send the password back
    return res.status(200).json({
      success: true,
      token,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        role:      user.role,
      },
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// POST /api/auth/register  (admin only)
async function register(req, res) {
  try {
    const { username, password, full_name, role, province_id, district_id, vehicle_id } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'username, password and role are required.' });
    }

    const validRoles = ['ADMIN', 'PROVINCIAL', 'DISTRICT', 'DEVICE'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // Check username not taken
    const existing = queryOne('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const id = run(
      'INSERT INTO users (username, password, full_name, role, province_id, district_id, vehicle_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username.toLowerCase(), hashedPassword, full_name || username, role, province_id || null, district_id || null, vehicle_id || null]
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: { id, username: username.toLowerCase(), role },
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

// GET /api/auth/me
function me(req, res) {
  try {
    const user = queryOne(
      'SELECT id, username, full_name, role, province_id, district_id, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });

  } catch (err) {
    console.error('Me error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong.' });
  }
}

module.exports = { login, register, me };
