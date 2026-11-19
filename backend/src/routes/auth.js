const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isText, isEmail, hasUnsafeChars } = require('../utils');

const router = express.Router();
const sign = (user) =>
  jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register  (students only)
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, room } = req.body || {};
    if (![name, email, password, room].every(isText)) {
      return res.status(400).json({ message: 'Name, email, password and room are required.' });
    }
    if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email.' });
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (hasUnsafeChars(name) || hasUnsafeChars(room)) {
      return res.status(400).json({ message: 'Name and room contain invalid characters.' });
    }
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const user = await User.create({
      name: name.trim(),
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'student', // role is fixed by the server, never taken from the body
      room: room.trim(),
    });
    res.status(201).json({ token: sign(user), user: user.toPublic() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const fail = () => res.status(401).json({ message: 'Email or password is incorrect.' });
    if (!isText(email) || !isText(password)) return fail();
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return fail();
    res.json({ token: sign(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
