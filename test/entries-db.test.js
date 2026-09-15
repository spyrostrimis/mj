// What actually gets stored, and what GET gives back.

import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet, onRequestPost } from '../functions/api/entries.js';
import { onRequestDelete } from '../functions/api/entries/[id].js';
import { freshDatabase } from './helpers/migrate.js';
import { d1 } from './helpers/d1.js';

const newEnv = () => ({ DB: d1(freshDatabase()) });

const post = (env, body) =>
  onRequestPost({
    request: new Request('https://mj.test/api/entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    env,
  });

const get = async (env) => {
  const res = await onRequestGet({ env });
  assert.equal(res.status, 200);
  return res.json();
};

const del = (env, id) => onRequestDelete({ params: { id }, env });

const rawRows = (env) =>
  env.DB._raw.prepare('SELECT * FROM moments ORDER BY id').all();

const monkey = (over = {}) => ({ id: 'm1', text: 'made me tea', lang: 'acts', ...over });
const turtle = (over = {}) => ({ id: 't1', text: 'said thank you', lang: 'words', ...over });
const at = (date, time, over = {}) => ({ date, time, ...over });

test('a lone monkey half is stored unpaired and read back with no turtle', async () => {
  const env = newEnv();
  const res = await post(env, at('2026-01-01', '09:00', { monkey: monkey() }));
  assert.equal(res.status, 201);

  const rows = rawRows(env);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, 'monkey');
  assert.equal(rows[0].pair_id, null);
  assert.equal(rows[0].body, 'made me tea');

  const feed = await get(env);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].id, 'm1');
  assert.equal(feed[0].pairId, null);
  assert.deepEqual(feed[0].monkey, { id: 'm1', text: 'made me tea', lang: 'acts' });
  assert.equal(feed[0].turtle, null);
});

test('a lone turtle half behaves the same way', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', { turtle: turtle() }));

  const feed = await get(env);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].monkey, null);
  assert.deepEqual(feed[0].turtle, { id: 't1', text: 'said thank you', lang: 'words' });
});

test('both halves become two rows and one moment', async () => {
  const env = newEnv();
  const res = await post(env, at('2026-01-01', '09:00', {
    pairId: 'p1', monkey: monkey(), turtle: turtle(),
  }));
  assert.equal(res.status, 201);

  const rows = rawRows(env);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.pair_id), ['p1', 'p1']);
  assert.deepEqual(rows.map((r) => r.subject).sort(), ['monkey', 'turtle']);

  const feed = await get(env);
  assert.equal(feed.length, 1, 'a pair is one moment, not two');
  assert.equal(feed[0].id, 'p1');
  assert.equal(feed[0].pairId, 'p1');
  assert.equal(feed[0].monkey.text, 'made me tea');
  assert.equal(feed[0].turtle.text, 'said thank you');
});

test('the 201 body is the same shape the feed returns', async () => {
  const env = newEnv();
  const res = await post(env, at('2026-01-01', '09:00', {
    pairId: 'p1', monkey: monkey(), turtle: turtle(),
  }));
  const { entry } = await res.json();
  const [fromFeed] = await get(env);
  assert.deepEqual(entry, fromFeed);
});

test('a pair write is atomic: a colliding half writes neither', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', { monkey: monkey({ id: 'taken' }) }));
  const before = rawRows(env).length;
  assert.equal(before, 1);

  const res = await post(env, at('2026-01-02', '10:00', {
    pairId: 'p9',
    monkey: monkey({ id: 'fresh-half' }),
    turtle: turtle({ id: 'taken' }),      // collides with the row above
  }));
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /already saved/);

  const after = rawRows(env);
  assert.equal(after.length, before, 'the batch must not leave a partial write');
  assert.equal(
    after.filter((r) => r.id === 'fresh-half').length, 0,
    'the first half of the failed pair must be rolled back'
  );

  // Positive control: the same pair with a free id writes both halves.
  const ok = await post(env, at('2026-01-02', '10:00', {
    pairId: 'p9', monkey: monkey({ id: 'fresh-half' }), turtle: turtle({ id: 'free' }),
  }));
  assert.equal(ok.status, 201);
  assert.equal(rawRows(env).length, 3);
});

test('text is stored trimmed', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', { monkey: monkey({ text: '   spaced out   ' }) }));
  assert.equal(rawRows(env)[0].body, 'spaced out');
});

test('the feed is newest first, by date then time', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', { monkey: monkey({ id: 'a' }) }));
  await post(env, at('2026-01-03', '08:00', { monkey: monkey({ id: 'b' }) }));
  await post(env, at('2026-01-02', '22:00', { monkey: monkey({ id: 'c' }) }));
  await post(env, at('2026-01-03', '21:00', { monkey: monkey({ id: 'd' }) }));

  const feed = await get(env);
  assert.deepEqual(feed.map((m) => m.id), ['d', 'b', 'c', 'a']);
});

test('deleting a pair removes both halves', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', {
    pairId: 'p1', monkey: monkey(), turtle: turtle(),
  }));
  await post(env, at('2026-01-02', '09:00', { monkey: monkey({ id: 'solo' }) }));
  assert.equal(rawRows(env).length, 3);

  const res = await del(env, 'p1');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted, 2, 'both halves of the pair');

  const left = rawRows(env);
  assert.equal(left.length, 1);
  assert.equal(left[0].id, 'solo', 'the unrelated single survives');
});

test('deleting a single removes exactly one row', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', {
    pairId: 'p1', monkey: monkey(), turtle: turtle(),
  }));
  await post(env, at('2026-01-02', '09:00', { monkey: monkey({ id: 'solo' }) }));

  const res = await del(env, 'solo');
  assert.equal((await res.json()).deleted, 1);

  const feed = await get(env);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].id, 'p1', 'the pair is untouched and still one moment');
  assert.ok(feed[0].monkey && feed[0].turtle, 'and still has both halves');
});

test('an empty journal reads back as an empty list', async () => {
  assert.deepEqual(await get(newEnv()), []);
});

test('a single whose id equals another moment pair_id stays separate', async () => {
  const env = newEnv();
  // 'x1' is used twice: once as a pair's pair_id, once as an unrelated lone
  // half's own id. Nothing stops that - they are different id spaces.
  await post(env, at('2026-01-01', '09:00', {
    pairId: 'x1', monkey: monkey({ id: 'm1' }), turtle: turtle({ id: 't1' }),
  }));
  await post(env, at('2026-01-02', '09:00', {
    monkey: monkey({ id: 'x1', text: 'an unrelated single' }),
  }));

  const feed = await get(env);
  assert.equal(feed.length, 2, 'the single must not be folded into the pair');

  const single = feed.find((m) => m.pairId === null);
  const pair = feed.find((m) => m.pairId === 'x1');

  assert.equal(single.id, 'x1');
  assert.equal(single.monkey.text, 'an unrelated single');
  assert.equal(single.turtle, null);

  assert.equal(pair.id, 'x1');
  assert.equal(pair.monkey.text, 'made me tea', 'the pair keeps its own monkey half');
  assert.equal(pair.turtle.text, 'said thank you');
});

test('deleting one half of a pair leaves the other, and GET still returns one moment', async () => {
  const env = newEnv();
  await post(env, at('2026-01-01', '09:00', {
    pairId: 'p1', monkey: monkey(), turtle: turtle(),
  }));

  const res = await del(env, 'm1');            // the half's own row id
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted, 1, 'the monkey half only, not the pair');

  const rows = rawRows(env);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 't1');
  assert.equal(rows[0].pair_id, 'p1', 'the survivor keeps its pair_id');

  const feed = await get(env);
  assert.equal(feed.length, 1, 'still one moment, not zero');
  assert.equal(feed[0].id, 'p1', 'and it still answers to the pair id');
  assert.equal(feed[0].pairId, 'p1');
  assert.equal(feed[0].monkey, null);
  assert.deepEqual(feed[0].turtle, { id: 't1', text: 'said thank you', lang: 'words' });

  // Positive control on the same fixture: deleting the survivor does take the
  // moment with it. Without this, every assertion above would hold just as
  // well if DELETE had quietly done nothing.
  assert.equal((await (await del(env, 't1')).json()).deleted, 1);
  assert.deepEqual(await get(env), [], 'the last half takes the moment');
  assert.equal(rawRows(env).length, 0);
});
