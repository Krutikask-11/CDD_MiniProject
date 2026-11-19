const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin', 'staff'], required: true },
  room: { type: String, trim: true },       // students only
  category: { type: String, trim: true },   // staff only, e.g. "Water supply"
  createdAt: { type: Date, default: Date.now },
});

// The shape the frontend expects after login/register: never includes the hash.
userSchema.methods.toPublic = function () {
  const u = { id: String(this._id), name: this.name, email: this.email, role: this.role };
  if (this.room) u.room = this.room;
  if (this.category) u.category = this.category;
  return u;
};

module.exports = mongoose.model('User', userSchema);
