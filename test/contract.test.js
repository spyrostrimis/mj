// The composer and the API agree on the wire format.
//
// buildMoment() is exactly what Sheet.jsx sends. These tests feed its real
// output straight into the real POST handler, so a change to either side that
// breaks the other fails here rather than in the browser.
//
// env.DB throws on any access: getting as far as it means validation accepted
// the body, and the 500 "Database error" is the signal for that.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMoment } from '../src/data.js';
import { deleteEntry } from '../src/api.js';
import { onRequestPost } from '../functions/api/entries.js';
import { onRequestDelete } from '../functions/api/entries/[id].js';
import { freshDatabase } from './helpers/migrate.js';
import { d1 } from './helpers/d1.js';

const explodingDB = new Proxy({}, {
  get(_target, prop) {
    throw new Error('the database was touched: .' + String(prop));
  },
});

const send = (moment) =>
  onRequestPost({
    request: new Request('https://mj.test/api/entries', {
      method: 'POST',
      body: JSON.stringify(moment),
    }),
    env: { DB: explodingDB },
  });

async function acceptedByServer(moment, what) {
  const res = await send(moment);
  const json = await res.json();
  assert.equal(
    res.status, 500,
    `${what}: the server rejected the composer's own payload with ` +
    `${res.status} ${JSON.stringify(json)}`
  );
  assert.equal(json.error, 'Database error');
}

const complete = (text, lang) => ({ text, lang });
const empty = { text: '', lang: '' };

test('a monkey-only moment from the composer passes validation', async () => {
  const moment = buildMoment(complete('TEST he made tea', 'acts'), empty);
  assert.ok(moment, 'the composer should be willing to save this');
  assert.equal(moment.pairId, null);
  assert.equal(moment.turtle, null);
  await acceptedByServer(moment, 'monkey-only');
});

test('a turtle-only moment from the composer passes validation', async () => {
  const moment = buildMoment(empty, complete('TEST I cooked', 'acts'));
  assert.ok(moment);
  assert.equal(moment.pairId, null);
  assert.equal(moment.monkey, null);
  await acceptedByServer(moment, 'turtle-only');
});

test('a paired moment from the composer passes validation', async () => {
  const moment = buildMoment(
    complete('TEST he waited in the rain', 'acts'),
    complete('TEST I said thank you', 'words')
  );
  assert.ok(moment);
  assert.ok(moment.pairId, 'a pair needs a pairId or the server rejects it');
  assert.equal(moment.id, moment.pairId);
  assert.notEqual(moment.monkey.id, moment.turtle.id);
  await acceptedByServer(moment, 'pair');
});

test('the composer refuses to build an unsaveable moment', async () => {
  // Positive control for the three above: when canSave is false there is no
  // payload at all, so nothing malformed can reach the API.
  assert.equal(buildMoment(empty, empty), null);
  assert.equal(buildMoment(complete('TEST started', ''), empty), null);
  assert.equal(
    buildMoment(complete('TEST ok', 'acts'), complete('TEST started', '')),
    null,
    'one complete half plus one started half is not saveable'
  );
});

test('every love language survives the round trip', async () => {
  for (const lang of ['words', 'acts', 'touch', 'gifts', 'time']) {
    await acceptedByServer(buildMoment(complete('TEST x', lang), empty), lang);
  }
});

// ---------------------------------------------------------------------------
// The delete wrapper and the DELETE handler agree on the wire format.
//
// The gap this closes: api.js and functions/ were changed on separate
// branches. Both sides' own tests passed, and the merge was textually clean,
// because nothing fed one into the other. Routing the real wrapper into the
// real handler is what makes a signature change on either side fail here.

test('the delete wrapper drives the real handler, for both id spaces', async () => {
  const env = { DB: d1(freshDatabase()) };

  const seed = (body) =>
    onRequestPost({
      request: new Request('https://mj.test/api/entries', {
        method: 'POST', body: JSON.stringify(body),
      }),
      env,
    });

  await seed({
    date: '2026-01-01', time: '09:00', pairId: 'p-1',
    monkey: { id: 'm-1', text: 'TEST pair monkey', lang: 'acts' },
    turtle: { id: 't-1', text: 'TEST pair turtle', lang: 'words' },
  });
  await seed({
    date: '2026-01-02', time: '10:00',
    monkey: { id: 'm-2', text: 'TEST lone monkey', lang: 'gifts' },
  });

  // Whatever deleteEntry puts on the wire is what the handler must answer to.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const full = new URL(url, 'https://mj.test');
    const id = decodeURIComponent(full.pathname.split('/').pop());
    return onRequestDelete({
      params: { id },
      request: new Request(full, { method: options.method }),
      env,
    });
  };

  try {
    const ids = () => env.DB._raw.prepare('SELECT id FROM moments ORDER BY id').all().map(r => r.id);

    // This is the call Shell.jsx makes when a half is deleted from the feed.
    assert.deepEqual(await deleteEntry('m-1', 'half'), { ok: true, deleted: 1 });
    assert.deepEqual(ids(), ['m-2', 't-1'], 'only that half went');

    // Positive control in the same run: the pair space still takes the rest
    // of the pair, so 'half' above is a real distinction.
    assert.deepEqual(await deleteEntry('p-1', 'pair'), { ok: true, deleted: 1 });
    assert.deepEqual(ids(), ['m-2'], "the pair's remaining half went with it");

    // And an unpaired moment goes as its own half.
    assert.deepEqual(await deleteEntry('m-2', 'half'), { ok: true, deleted: 1 });
    assert.deepEqual(ids(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
