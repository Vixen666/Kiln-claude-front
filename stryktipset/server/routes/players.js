const express = require('express');
const { pool } = require('../db');
const { attachUser, requireAdmin } = require('./auth');
const router = express.Router();

router.use(attachUser);

// GET /api/players
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM players ORDER BY position, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/players
router.post('/', requireAdmin, async (req, res) => {
  const { name, color, position } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO players (name, color, position) VALUES ($1, $2, $3) RETURNING *',
      [name, color || 'blue', position || 0]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/players/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, color, position } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE players SET name=$1, color=$2, position=$3 WHERE id=$4 RETURNING *',
      [name, color, position, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/players/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
