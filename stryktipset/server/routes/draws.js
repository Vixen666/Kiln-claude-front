const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const SPEL_API = 'https://api.spela.svenskaspel.se/draw/1/stryktipset/draws';

// Derive 1/X/2 outcome from a drawEvent using the "Current" result.
// Returns null if game hasn't started (result array is empty).
function deriveOutcome(event) {
  const results = event.match?.result;
  if (!results || results.length === 0) return null; // not started yet
  const current = results.find(r => r.sportEventResultType === 'Current');
  if (!current) return null;
  const home = parseInt(current.home);
  const away = parseInt(current.away);
  if (isNaN(home) || isNaN(away)) return null;
  return home > away ? '1' : home === away ? 'X' : '2';
}

// Map Swedish status strings to a simple display status
function mapStatus(event) {
  const s = event.match?.sportEventStatus || '';
  const label = event.match?.status || '';
  // Not started
  if (s === 'NotStarted') return 'not_started';
  // Finished
  if (s === 'Ended' || label === 'Slut') return 'finished';
  // Any live state (FirstHalf, SecondHalf, HalfTime, ExtraTime, etc.)
  return 'live';
}

function formatDraw(draw) {
  return {
    drawNumber: draw.drawNumber,
    week: draw.drawComment?.match(/\d{4}-(\d+)/)?.[1] || null,
    year: draw.drawComment?.match(/(\d{4})/)?.[1] || null,
    regCloseTime: draw.regCloseTime,
    drawState: draw.drawState,
    events: (draw.drawEvents || []).map(e => {
      const results = e.match?.result || [];
      const current = results.find(r => r.sportEventResultType === 'Current');
      return {
        eventNumber: e.eventNumber,
        description: e.eventDescription,
        home: e.match?.participants?.find(p => p.type === 'home')?.name || '',
        away: e.match?.participants?.find(p => p.type === 'away')?.name || '',
        statusLabel: e.match?.status || '',          // e.g. "Första halvlek", "Slut", "Inte startat"
        status: mapStatus(e),                         // 'not_started' | 'live' | 'finished'
        outcome: deriveOutcome(e),                    // null | '1' | 'X' | '2'
        score: current ? `${current.home}–${current.away}` : null,
        odds: e.odds
      };
    })
  };
}

// GET /api/draws/current
// The base URL returns a list — we pick the most relevant draw:
// prefer Closed/Open (active round) over Finalized ones.
router.get('/current', async (req, res) => {
  try {
    const r = await fetch(SPEL_API);
    const data = await r.json();
    const draws = data.draws || (data.draw ? [data.draw] : []);
    if (!draws.length) return res.status(404).json({ error: 'No draws found' });
    // Prefer non-finalized draws; fall back to first
    const current = draws.find(d => d.drawState !== 'Finalized') || draws[0];
    res.json(formatDraw(current));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/draws/:number
router.get('/:number', async (req, res) => {
  try {
    const r = await fetch(`${SPEL_API}/${req.params.number}`);
    const data = await r.json();
    const draw = data.draw || data.draws?.[0];
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    res.json(formatDraw(draw));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, deriveOutcome };
