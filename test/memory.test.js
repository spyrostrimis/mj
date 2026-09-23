// "Remember when": which moments it draws from, and that "Another" always
// moves to a different one.

import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryPool, nextSeed, memoryLabel } from '../src/data.js';

const pair = { id: 'p', date: '2026-03-14', time: '09:04', monkey: { lang: 'words' }, turtle: { lang: 'acts' } };
const mOnly = { id: 'm', date: '2026-03-15', time: '10:00', monkey: { lang: 'time' }, turtle: null };
const tOnly = { id: 't', date: '2026-03-16', time: '11:00', monkey: null, turtle: { lang: 'gifts' } };

test('Him and Me draw only their own halves; Both draws every moment', () => {
  const him = memoryPool([pair, mOnly, tOnly], 'monkey');
  assert.deepEqual(him.map(e => e.id), ['p', 'm']);
  assert.equal(him[0].turtle, null, "a pair shows only Monkey's half on Him");
  assert.deepEqual(him[0].monkey, pair.monkey);

  const me = memoryPool([pair, mOnly, tOnly], 'turtle');
  assert.deepEqual(me.map(e => e.id), ['p', 't']);
  assert.equal(me[0].monkey, null);

  assert.equal(memoryPool([pair, mOnly, tOnly], 'both').length, 3);
  assert.ok(pair.turtle, 'the pool never edits the moment it came from');
});

test('Another never lands on the moment it replaces', () => {
  for (const len of [2, 3, 7]) {
    for (const seed of [0, 1, 5, 999]) {
      for (const r of [0, 0.25, 0.5, 0.999999]) {
        const next = nextSeed(seed, len, r);
        assert.notEqual(next % len, seed % len, `len ${len}, seed ${seed}, r ${r}`);
      }
    }
  }
});

test('Another can reach every other moment', () => {
  const len = 5, seed = 10;
  const reached = new Set();
  for (let i = 0; i < len - 1; i++) reached.add(nextSeed(seed, len, i / (len - 1)) % len);
  assert.equal(reached.size, len - 1);
});

test('a memory is dated in full, with its year', () => {
  assert.equal(memoryLabel(pair), 'Sat · Mar 14, 2026 · 09:04');
});
