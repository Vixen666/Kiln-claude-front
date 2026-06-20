const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const { attachUser, requireAdmin } = require('./auth');
const { deriveOutcome } = require('./draws');
const router = express.Router();

router.use(attachUser);

const SPEL_API = 'https://api.spela.svenskaspel.se/draw/1/stryktipset/draws';

// Parse the Svenska Spel bet URL into picks
// signs=1:1;X,2:1,3:2 → { 1: ['1','X'], 2: ['1'], 3: ['2'] }
function parseSignsParam(signs) {
  if (!signs) return {};
  const picks = {};
  signs.split(',').forEach(part => {
    const [num, vals] = part.split(':');
    picks[parseInt(num)] = vals.split(';');
  });
  return picks;
}

// GET /api/bets
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    let query = `
      SELECT b.*, p.name as player_name, p.color as player_color
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
    `;
    const params = [];
    if (year) {
      query += ' WHERE b.year = $1';
      params.push(year);
    }
    query += ' ORDER BY b.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bets - add a bet (paste the spela.se URL or provide manually)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { player_id, bet_url, draw_number, picks, winnings } = req.body;

    let finalDrawNumber = draw_number;
    let finalPicks = picks; // { 1: ['1','X'], 2: ['1'], ... }

    // If a bet_url was pasted, parse it
    if (bet_url) {
      const url = new URL(bet_url);
      finalDrawNumber = parseInt(url.searchParams.get('draw'));
      const week = url.searchParams.get('week');
      const signs = url.searchParams.get('signs');
      finalPicks = parseSignsParam(signs);
    }

    if (!finalDrawNumber || !finalPicks) {
      return res.status(400).json({ error: 'draw_number and picks are required' });
    }

    // Fetch draw info to get week/year
    const r = await fetch(`${SPEL_API}/${finalDrawNumber}`);
    const data = await r.json();
    const draw = data.draw || data.draws?.[0];
    const week = draw?.drawComment?.match(/\d{4}-(\d+)/)?.[1] || null;
    const year = draw?.drawComment?.match(/(\d{4})/)?.[1] || new Date().getFullYear();

    const { rows } = await pool.query(
      `INSERT INTO bets (player_id, draw_number, week, year, picks, bet_url, winnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [player_id, finalDrawNumber, week, year, JSON.stringify(finalPicks), bet_url || null, winnings || 0]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bets/:id/sync-results - fetch results from Svenska Spel and auto-correct
router.post('/:id/sync-results', requireAdmin, async (req, res) => {
  try {
    const { rows: [bet] } = await pool.query('SELECT * FROM bets WHERE id=$1', [req.params.id]);
    if (!bet) return res.status(404).json({ error: 'Bet not found' });

    const r = await fetch(`${SPEL_API}/${bet.draw_number}`);
    const data = await r.json();
    const draw = data.draw || data.draws?.[0];
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const picks = bet.picks; // { "1": ["1","X"], "2": ["1"], ... }
    let correctCount = 0;
    const results = {};

    draw.drawEvents.forEach(event => {
      const num = String(event.eventNumber);
      const outcome = deriveOutcome(event); // '1', 'X', '2', or null
      const eventPicks = picks[num] || [];
      const isCorrect = outcome !== null && eventPicks.includes(outcome);
      if (isCorrect) correctCount++;
      results[num] = {
        outcome,
        picks: eventPicks,
        correct: isCorrect,
        score: (() => {
          const cur = event.match?.result?.find(r => r.sportEventResultType === 'Current');
          return cur ? `${cur.home}–${cur.away}` : null;
        })(),
        status: event.match?.status || ''
      };
    });

    // Check if all games are done
    const allDone = draw.drawEvents.every(e => e.match?.status === 'Slut' || e.cancelled);

    const { rows: [updated] } = await pool.query(
      `UPDATE bets SET results=$1, correct_count=$2, finalized=$3 WHERE id=$4 RETURNING *`,
      [JSON.stringify(results), correctCount, allDone, req.params.id]
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bets/:id - update winnings or player
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { winnings, player_id } = req.body;
    const { rows } = await pool.query(
      'UPDATE bets SET winnings=$1, player_id=$2 WHERE id=$3 RETURNING *',
      [winnings, player_id, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bets/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM bets WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
