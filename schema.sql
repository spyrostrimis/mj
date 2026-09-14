-- Monkey Journal - D1 (SQLite) schema.
-- Run once against local, once against remote. See README.

CREATE TABLE IF NOT EXISTS moments (
  id          TEXT PRIMARY KEY,
  entry_date  TEXT NOT NULL,          -- 'YYYY-MM-DD'
  entry_time  TEXT NOT NULL,          -- 'HH:MM'
  monkey_text TEXT NOT NULL,
  monkey_lang TEXT NOT NULL,          -- words | acts | touch | gifts | time
  turtle_text TEXT NOT NULL,
  turtle_lang TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_moments_date
  ON moments (entry_date DESC, entry_time DESC);
