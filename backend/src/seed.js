// npm run seed  - creates admin, staff and a demo student if missing.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const accounts = [
  { name: 'Warden Rao', email: 'admin@nie.ac.in', password: 'admin123', role: 'admin' },
  { name: 'Ravi (Plumber)', email: 'ravi@nie.ac.in', password: 'staff123', role: 'staff', category: 'Water supply' },
  { name: 'Suma (Electrician)', email: 'suma@nie.ac.in', password: 'staff123', role: 'staff', category: 'Electricity' },
  { name: 'Demo Student', email: 'student@nie.ac.in', password: 'student123', role: 'student', room: 'B-214' },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const { password, ...rest } of accounts) {
      if (await User.findOne({ email: rest.email })) {
        console.log('exists :', rest.email);
        continue;
      }
      await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
      console.log('created:', rest.email);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
