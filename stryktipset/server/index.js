require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../client')));

// API routes
app.use('/api/auth',    require('./routes/auth').router);
app.use('/api/players', require('./routes/players'));
app.use('/api/draws',   require('./routes/draws').router);
app.use('/api/bets',    require('./routes/bets'));

// Health check for Railway
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Catch-all → serve frontend (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
