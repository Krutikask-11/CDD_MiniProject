const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff  (any logged-in user)
router.get('/', auth, async (req, res, next) => {
  try {
    const staff = await User.find({ role: 'staff' }).sort({ name: 1 });
    res.json(
      staff.map((s) => ({
        id: String(s._id),
        name: s.name,
        email: s.email,
        role: s.role,
        category: s.category || null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
