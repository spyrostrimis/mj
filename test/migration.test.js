// The migration is the contract the API relies on: a half is a row, a pair is
// two rows sharing a pair_id, and the schema itself refuses anything else.

import test from 'node:test';
import assert from 'node:assert/strict';

import { freshDatabase, migrationFiles } from './helpers/migrate.js';

const INSERT = `INSERT INTO moments (id, pair_id, subject, lang, body, entry_date, entry_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

// A valid row, so each test varies exactly one thing.
const row = (over = {}) => {
  const r = {
    id: 'm1', pair_id: null, subject: 'monkey', lang: 'acts',
    body: 'made me tea', entry_date: '2026-01-01', entry_time: '09:00', ...over,
  };
  return [r.id, r.pair_id, r.subject, r.lang, r.body, r.entry_date, r.entry_time];
};

const insert = (db, over) => db.prepare(INSERT).run(...row(over));
const rejects = (db, over, pattern) =>
  assert.throws(() => insert(db, over), pattern, `expected ${JSON.stringify(over)} to be rejected`);

test('there is exactly one migration, named 0001', () => {
  assert.deepEqual(migrationFiles(), ['0001_moments_per_half.sql']);
});

test('the table has the per-half columns', () => {
  const db = freshDatabase();
  const cols = Object.fromEntries(
    db.prepare('PRAGMA table_info(moments)').all().map(c => [c.name, c])
  );

  assert.deepEqual(Object.keys(cols), [
    'id', 'pair_id', 'subject', 'lang', 'body', 'entry_date', 'entry_time', 'created_at',
  ]);

  // pair_id is the only nullable content column - that is the single/pair switch.
  assert.equal(cols.pair_id.notnull, 0);
  for (const name of ['subject', 'lang', 'body', 'entry_date', 'entry_time', 'created_at']) {
    assert.equal(cols[name].notnull, 1, `${name} should be NOT NULL`);
  }
  assert.equal(cols.id.pk, 1);

  // None of the old paired-row columns survive.
  for (const gone of ['monkey_text', 'monkey_lang', 'turtle_text', 'turtle_lang']) {
    assert.ok(!(gone in cols), `${gone} should be gone`);
  }
});

test('created_at is filled in automatically', () => {
  const db = freshDatabase();
  insert(db);
  const { created_at } = db.prepare('SELECT created_at FROM moments').get();
  assert.match(created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('subject must be monkey or turtle', () => {
  const db = freshDatabase();
  insert(db, { id: 'a', subject: 'monkey' });      // positive controls
  insert(db, { id: 'b', subject: 'turtle' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM moments').get().n, 2);

  rejects(db, { id: 'c', subject: 'hamster' }, /CHECK constraint failed/);
  rejects(db, { id: 'd', subject: 'Monkey' }, /CHECK constraint failed/);
  rejects(db, { id: 'e', subject: '' }, /CHECK constraint failed/);
});

test('lang must be one of the five love languages', () => {
  const db = freshDatabase();
  for (const lang of ['words', 'acts', 'touch', 'gifts', 'time']) {
    insert(db, { id: 'ok-' + lang, lang });        // positive control: all five
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM moments').get().n, 5);

  rejects(db, { id: 'x', lang: 'snacks' }, /CHECK constraint failed/);
  rejects(db, { id: 'y', lang: 'Words' }, /CHECK constraint failed/);
});

test('body must be non-blank and at most 2000 characters', () => {
  const db = freshDatabase();
  insert(db, { id: 'a', body: 'x' });                      // positive controls
  insert(db, { id: 'b', body: 'y'.repeat(2000) });         // boundary: exactly 2000
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM moments').get().n, 2);

  rejects(db, { id: 'c', body: '' }, /CHECK constraint failed/);
  rejects(db, { id: 'd', body: '   ' }, /CHECK constraint failed/);
  rejects(db, { id: 'e', body: '\n\t ' }, /CHECK constraint failed/);
  rejects(db, { id: 'f', body: 'z'.repeat(2001) }, /CHECK constraint failed/);
});

test('entry_date and entry_time must be the stored formats', () => {
  const db = freshDatabase();
  insert(db, { id: 'a', entry_date: '2026-12-31', entry_time: '23:59' });   // control

  rejects(db, { id: 'b', entry_date: '2026-1-1' }, /CHECK constraint failed/);
  rejects(db, { id: 'c', entry_date: '31-12-2026' }, /CHECK constraint failed/);
  rejects(db, { id: 'd', entry_date: 'yesterday' }, /CHECK constraint failed/);
  rejects(db, { id: 'e', entry_time: '9:00' }, /CHECK constraint failed/);
  rejects(db, { id: 'f', entry_time: '09:00:00' }, /CHECK constraint failed/);
});

test('a pair holds at most one monkey half and one turtle half', () => {
  const db = freshDatabase();
  insert(db, { id: 'm', pair_id: 'p1', subject: 'monkey' });   // positive control
  insert(db, { id: 't', pair_id: 'p1', subject: 'turtle' });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM moments WHERE pair_id='p1'").get().n, 2);

  rejects(db, { id: 'm2', pair_id: 'p1', subject: 'monkey' }, /UNIQUE constraint failed/);
  rejects(db, { id: 't2', pair_id: 'p1', subject: 'turtle' }, /UNIQUE constraint failed/);
});

test('unpaired halves are unlimited - NULL pair_ids stay distinct', () => {
  const db = freshDatabase();
  // This is the assumption the whole single-half design rests on.
  for (let i = 0; i < 5; i++) insert(db, { id: 'solo' + i, pair_id: null, subject: 'monkey' });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM moments WHERE pair_id IS NULL').get().n, 5
  );
});

test('ids are unique across every half', () => {
  const db = freshDatabase();
  insert(db, { id: 'dupe', subject: 'monkey' });
  rejects(db, { id: 'dupe', subject: 'turtle', pair_id: 'p9' }, /UNIQUE constraint failed/);
});

test('both indexes exist', () => {
  const db = freshDatabase();
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()
    .map(r => r.name);
  assert.ok(names.includes('idx_moments_date'), 'missing idx_moments_date');
  assert.ok(names.includes('idx_moments_pair_subject'), 'missing idx_moments_pair_subject');
});
