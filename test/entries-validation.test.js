// POST /api/entries validation.
//
// env.DB throws on any property access, so a test that asserts 400 also proves
// validation rejected the body before touching the database. A body that IS
// valid reaches the DB and comes back 500 "Database error" - that 500 is the
// positive control throughout this file.

import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/entries.js';

const explodingDB = new Proxy({}, {
  get(_target, prop) {
    throw new Error('the database was touched: .' + String(prop));
  },
});

const post = (body) =>
  onRequestPost({
    request: new Request('https://mj.test/api/entries', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env: { DB: explodingDB },
  });

const monkey = (over = {}) => ({ id: 'm1', text: 'made me tea', lang: 'acts', ...over });
const turtle = (over = {}) => ({ id: 't1', text: 'said thank you', lang: 'words', ...over });
const base = (over = {}) => ({ date: '2026-01-01', time: '09:00', ...over });

// Rejected before the DB: status 400 and the given message.
async function rejects(body, message) {
  const res = await post(body);
  assert.equal(res.status, 400, `expected 400, got ${res.status}`);
  const json = await res.json();
  if (message) assert.match(json.error, message);
  return json;
}

// Accepted by validation: it got as far as the exploding DB.
async function reachesDatabase(body) {
  const res = await post(body);
  assert.equal(res.status, 500, `expected validation to pass, got ${res.status}`);
  assert.equal((await res.json()).error, 'Database error');
}

test('a valid single half and a valid pair both reach the database', async () => {
  await reachesDatabase(base({ monkey: monkey() }));
  await reachesDatabase(base({ turtle: turtle() }));
  await reachesDatabase(base({ pairId: 'p1', monkey: monkey(), turtle: turtle() }));
});

test('a body with neither half is rejected', async () => {
  await rejects(base(), /Nothing to save/);
  await rejects(base({ monkey: null, turtle: null }), /Nothing to save/);
});

test('a half with text but no love language names that half', async () => {
  await rejects(base({ monkey: monkey({ lang: '' }) }), /Monkey's half needs a love language/);
  await rejects(base({ turtle: turtle({ lang: undefined }) }), /Turtle's half needs a love language/);
});

test('a half with a love language but no text names that half', async () => {
  await rejects(base({ monkey: monkey({ text: '' }) }), /Monkey's half needs a few words/);
  await rejects(base({ turtle: turtle({ text: '   ' }) }), /Turtle's half needs a few words/);
});

test('one complete half plus one half-filled half is rejected', async () => {
  // The decided rule: an absent half is fine, a started one is not.
  await rejects(
    base({ pairId: 'p1', monkey: monkey(), turtle: turtle({ lang: '' }) }),
    /Turtle's half needs a love language/
  );
  await rejects(
    base({ pairId: 'p1', monkey: monkey({ text: '' }), turtle: turtle() }),
    /Monkey's half needs a few words/
  );
  // Control: the same complete half with the other one absent goes through.
  await reachesDatabase(base({ monkey: monkey() }));
});

test('an unknown love language is rejected, and all five are accepted', async () => {
  await rejects(base({ monkey: monkey({ lang: 'snacks' }) }), /love language/);
  await rejects(base({ monkey: monkey({ lang: 'Words' }) }), /love language/);
  for (const lang of ['words', 'acts', 'touch', 'gifts', 'time']) {
    await reachesDatabase(base({ monkey: monkey({ lang }) }));
  }
});

test('text longer than 2000 characters is rejected at the boundary', async () => {
  await reachesDatabase(base({ monkey: monkey({ text: 'y'.repeat(2000) }) }));
  await rejects(base({ monkey: monkey({ text: 'y'.repeat(2001) }) }), /too long/);
  // Trailing whitespace does not count towards the limit - the server trims.
  await reachesDatabase(base({ monkey: monkey({ text: 'y'.repeat(2000) + '   ' }) }));
});

test('pairId is required for a pair and forbidden for a single', async () => {
  await rejects(base({ monkey: monkey(), turtle: turtle() }));
  await rejects(base({ pairId: '', monkey: monkey(), turtle: turtle() }));
  await rejects(base({ pairId: 'p1', monkey: monkey() }));
  await rejects(base({ pairId: 'p1', turtle: turtle() }));
  // Controls: a pair with a pairId, and a single without one.
  await reachesDatabase(base({ pairId: 'p1', monkey: monkey(), turtle: turtle() }));
  await reachesDatabase(base({ monkey: monkey() }));
});

test('the two halves of a pair cannot share an id', async () => {
  await rejects(base({ pairId: 'p1', monkey: monkey({ id: 'same' }), turtle: turtle({ id: 'same' }) }));
  await reachesDatabase(
    base({ pairId: 'p1', monkey: monkey({ id: 'a' }), turtle: turtle({ id: 'b' }) })
  );
});

test('a half without a usable id is rejected', async () => {
  await rejects(base({ monkey: monkey({ id: '' }) }));
  await rejects(base({ monkey: monkey({ id: 42 }) }));
  await rejects(base({ monkey: monkey({ id: 'x'.repeat(65) }) }));
  await reachesDatabase(base({ monkey: monkey({ id: 'x'.repeat(64) }) }));
});

test('a malformed date or time is rejected', async () => {
  await rejects(base({ date: '2026-1-1', monkey: monkey() }), /date or time/);
  await rejects(base({ date: 'yesterday', monkey: monkey() }), /date or time/);
  await rejects(base({ time: '9:00', monkey: monkey() }), /date or time/);
  await rejects(base({ time: '09:00:00', monkey: monkey() }), /date or time/);
  await rejects({ monkey: monkey() }, /date or time/);
});

test('a body that is not a JSON object is rejected', async () => {
  await rejects('not json at all', /Invalid request/);
  await rejects('[]', /Invalid request/);
  await rejects('"a string"', /Invalid request/);
  await rejects('null', /Invalid request/);
});
