// Builds the Express app. Kept separate from server.js so tests can import it
// without opening a port.
const express = require('express');
const cors = require('cors');

const app = express();

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:8080').split(',').map((s) => s.trim());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '3mb' })); // room for a ~2 MB photo as base64

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/staff', require('./routes/staff'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found.' }));

// Central error handler: always { message }
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(400).json({ message: 'Request is too large (photo over the limit).' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

module.exports = app;
