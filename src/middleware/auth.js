// middleware/auth.js
// Checks the JWT token on every request that needs it

const jwt = require('jsonwebtoken');

// Verify the token from the Authorization header
function protect(req, res, next) {
  const header = req.headers.authorization;

  // Token must be in format: Bearer <token>
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login first.',
    });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

// Check if the logged-in user has one of the allowed roles
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of these roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { protect, allowRoles };
