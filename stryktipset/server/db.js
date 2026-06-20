const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      color     TEXT DEFAULT 'blue',
      position  INT  DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bets (
      id            SERIAL PRIMARY KEY,
      player_id     INT REFERENCES players(id) ON DELETE SET NULL,
      draw_number   INT NOT NULL,
      week          INT NOT NULL,
      year          INT NOT NULL,
      picks         JSONB NOT NULL,
      results       JSONB,
      correct_count INT,
      winnings      INT DEFAULT 0,
      bet_url       TEXT,
      finalized     BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Database ready');
}

module.exports = { pool, initDb };
