const mongoose = require('mongoose');
const { CATEGORIES, STATUSES } = require('../utils');

// Counter collection gives C-1001, C-1002, ... safely (atomic $inc).
const Counter = mongoose.model(
  'Counter',
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema({
  _id: { type: String }, // our own id like "C-1001"
  category: { type: String, enum: CATEGORIES, required: true },
  room: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  photo: { type: String, default: null },
  status: { type: String, enum: STATUSES, default: 'Open' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  history: [historySchema],
});

// JSON output: id (string) instead of _id, no __v, ids as plain strings.
complaintSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = String(ret._id);
    ret.studentId = String(ret.studentId);
    ret.assignedTo = ret.assignedTo ? String(ret.assignedTo) : null;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

complaintSchema.statics.nextId = async function () {
  const c = await Counter.findOneAndUpdate(
    { _id: 'complaint' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return 'C-' + (1000 + c.seq); // first one is C-1001
};

module.exports = mongoose.model('Complaint', complaintSchema);
