require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const { MONGODB_URI, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 5000;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error('MONGODB_URI and JWT_SECRET must be set (see .env.example).');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
