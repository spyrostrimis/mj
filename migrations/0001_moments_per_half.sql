-- One row per half, replacing the paired-row `moments` table.
--
-- The previous table required a Monkey half and a Turtle half on every row, so
-- there was no way to record only one side of a day. Halves are now independent
-- rows; two saved together share a pair_id and are written in one batch().
--
-- The previous table held only a deploy-test row. A --remote export was taken
-- before this was applied.

DROP TABLE IF EXISTS moments;

CREATE TABLE moments (
  id         TEXT PRIMARY KEY,
  pair_id    TEXT,
  subject    TEXT NOT NULL CHECK (subject IN ('monkey', 'turtle')),
  lang       TEXT NOT NULL CHECK (lang IN ('words', 'acts', 'touch', 'gifts', 'time')),
  -- SQLite's one-argument trim() strips spaces only, so tabs and newlines are
  -- listed explicitly. The server trims with JS .trim() before it gets here;
  -- this is the backstop.
  body       TEXT NOT NULL CHECK (
               length(trim(body, char(32) || char(9) || char(10) || char(13))) > 0
               AND length(body) <= 2000
             ),
  entry_date TEXT NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  entry_time TEXT NOT NULL CHECK (entry_time GLOB '[0-9][0-9]:[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The feed reads newest-first across all time.
CREATE INDEX idx_moments_date ON moments (entry_date DESC, entry_time DESC);

-- At most one Monkey half and one Turtle half per pair. NULLs are distinct in a
-- SQLite unique index, so unpaired rows are left unconstrained by this - which
-- is exactly what makes a lone half possible.
CREATE UNIQUE INDEX idx_moments_pair_subject ON moments (pair_id, subject);
