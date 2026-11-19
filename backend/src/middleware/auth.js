const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the Bearer token and loads the user from the database,
// so the role always comes from the DB, never from the client.
async function auth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Please log in again.' });
    req.user = user;
  } catch (err) {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
  next();
}

// Use after auth: requireRole('admin', 'staff')
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do this.' });
  }
  next();
};

module.exports = { auth, requireRole };
