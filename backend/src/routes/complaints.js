const express = require('express');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { CATEGORIES, STATUSES, MAX_PHOTO_CHARS, isText, hasUnsafeChars } = require('../utils');

const router = express.Router();
const bad = (res, message) => res.status(400).json({ message });
const forbid = (res, message) => res.status(403).json({ message });

// GET /api/complaints  - students: own, admin: all, staff: assigned to them
router.get('/', auth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'student') filter.studentId = req.user._id;
    if (req.user.role === 'staff') filter.assignedTo = req.user._id;
    const list = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints  - students only
router.post('/', auth, requireRole('student'), async (req, res, next) => {
  try {
    const { category, room, description, photo } = req.body || {};
    if (!CATEGORIES.includes(category)) return bad(res, 'Please choose a valid category.');
    if (!isText(room) || !isText(description)) {
      return bad(res, 'Room and description are required.');
    }
    if (room.length > 30 || description.length > 2000) {
      return bad(res, 'Room or description is too long.');
    }
    if (hasUnsafeChars(room) || hasUnsafeChars(description)) {
      return bad(res, 'Room and description contain invalid characters.');
    }
    let photoValue = null;
    if (photo !== undefined && photo !== null && photo !== '') {
      if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > MAX_PHOTO_CHARS) {
        return bad(res, 'Photo must be an image of about 2 MB or less.');
      }
      photoValue = photo;
    }
    const complaint = await Complaint.create({
      _id: await Complaint.nextId(),
      category,
      room: room.trim(),
      description: description.trim(),
      photo: photoValue,
      studentId: req.user._id,      // from the token, not the body
      studentName: req.user.name,
      history: [{ status: 'Open', note: 'Complaint submitted' }],
    });
    res.status(201).json(complaint);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/complaints/:id  - admin or staff
router.patch('/:id', auth, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(String(req.params.id));
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });

    const body = req.body || {};
    const hasAssign = Object.prototype.hasOwnProperty.call(body, 'assignedTo');
    const hasStatus = body.status !== undefined;
    if (!hasAssign && !hasStatus) return bad(res, 'Nothing to update.');
    if (hasStatus && !STATUSES.includes(body.status)) return bad(res, 'Invalid status.');

    if (req.user.role === 'staff') {
      if (hasAssign) return forbid(res, 'Staff cannot assign complaints.');
      if (!complaint.assignedTo || String(complaint.assignedTo) !== String(req.user._id)) {
        return forbid(res, 'This complaint is not assigned to you.');
      }
      if (STATUSES.indexOf(body.status) !== STATUSES.indexOf(complaint.status) + 1) {
        return forbid(res, 'Staff can only move a complaint forward by one step.');
      }
    }

    if (hasAssign) {
      const v = body.assignedTo;
      if (v === null || v === '') {
        if (complaint.assignedTo) {
          complaint.assignedTo = null;
          complaint.history.push({ status: complaint.status, note: 'Assignment removed' });
        }
      } else {
        if (typeof v !== 'string' || !mongoose.isValidObjectId(v)) return bad(res, 'Invalid staff id.');
        const staff = await User.findOne({ _id: v, role: 'staff' });
        if (!staff) return bad(res, 'Staff member not found.');
        if (String(complaint.assignedTo) !== String(staff._id)) {
          complaint.assignedTo = staff._id;
          complaint.history.push({ status: complaint.status, note: `Assigned to ${staff.name}` });
        }
      }
    }

    if (hasStatus && body.status !== complaint.status) {
      complaint.status = body.status;
      complaint.history.push({ status: body.status, note: `Status changed to ${body.status}` });
    }

    await complaint.save();
    res.json(complaint);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
