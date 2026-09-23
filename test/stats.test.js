// What Insights counts once halves are independent.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeStats, topLangs, listLangs } from '../src/data.js';

const pair = (id, mLang, tLang) => ({
  id, pairId: id, date: '2026-01-01', time: '09:00',
  monkey: { id: id + 'm', text: 'x', lang: mLang },
  turtle: { id: id + 't', text: 'y', lang: tLang },
});
const monkeyOnly = (id, lang) => ({
  id, pairId: null, date: '2026-01-01', time: '09:00',
  monkey: { id, text: 'x', lang }, turtle: null,
});
const turtleOnly = (id, lang) => ({
  id, pairId: null, date: '2026-01-01', time: '09:00',
  monkey: null, turtle: { id, text: 'y', lang },
});

test('each subject is counted against its own halves', () => {
  // 1 pair + 2 monkey singles + 1 turtle single = 4 moments,
  // 3 monkey halves and 2 turtle halves.
  const entries = [
    pair('p1', 'acts', 'words'),
    monkeyOnly('a', 'acts'),
    monkeyOnly('b', 'time'),
    turtleOnly('c', 'words'),
  ];
  const stats = computeStats(entries);

  assert.equal(stats.momentCount, 4, 'a pair is one moment');
  assert.equal(stats.monkeyTotal, 3);
  assert.equal(stats.turtleTotal, 2);

  assert.equal(stats.monkey.acts, 2);
  assert.equal(stats.monkey.time, 1);
  assert.equal(stats.turtle.words, 2);
  assert.equal(stats.turtle.acts, 0);

  // The point of per-subject totals: Monkey's acts is 2 of 3 halves, not 2 of
  // 4 moments, so a lone Turtle half cannot shrink a Monkey bar.
  assert.equal(stats.monkey.acts / stats.monkeyTotal, 2 / 3);
});

test('a missing half is not counted as a blank half', () => {
  const stats = computeStats([monkeyOnly('a', 'acts')]);
  assert.equal(stats.turtleTotal, 0);
  assert.deepEqual(Object.values(stats.turtle), [0, 0, 0, 0, 0]);
});

test('an all-pairs journal still counts the way it always did', () => {
  // Positive control: where every moment has both halves, both totals equal
  // the moment count - so this test would pass under the old shared
  // denominator too, and it is the mixed fixture above that discriminates.
  const entries = [pair('p1', 'acts', 'words'), pair('p2', 'time', 'words')];
  const stats = computeStats(entries);
  assert.equal(stats.monkeyTotal, 2);
  assert.equal(stats.turtleTotal, 2);
  assert.equal(stats.momentCount, 2);
});

test('an empty journal has no totals', () => {
  const stats = computeStats([]);
  assert.equal(stats.momentCount, 0);
  assert.equal(stats.monkeyTotal, 0);
  assert.equal(stats.turtleTotal, 0);
});

test('topLangs returns nothing rather than inventing a favourite', () => {
  const nothing = computeStats([turtleOnly('c', 'words')]);
  assert.deepEqual(topLangs(nothing.monkey), [], 'Monkey has logged nothing');
  assert.deepEqual(topLangs(nothing.turtle), ['words'], 'positive control');
});

test('topLangs picks the highest count', () => {
  const stats = computeStats([
    monkeyOnly('a', 'touch'), monkeyOnly('b', 'touch'), monkeyOnly('c', 'gifts'),
  ]);
  assert.deepEqual(topLangs(stats.monkey), ['touch']);
});

test('topLangs reports a tie as a tie, in LANGS order', () => {
  // Touch is logged first, so a first-seen winner would be touch alone.
  const stats = computeStats([
    monkeyOnly('a', 'touch'), monkeyOnly('b', 'words'), monkeyOnly('c', 'gifts'),
    monkeyOnly('d', 'touch'), monkeyOnly('e', 'words'),
  ]);
  assert.deepEqual(topLangs(stats.monkey), ['words', 'touch']);
});

test('listLangs reads like a sentence', () => {
  assert.equal(listLangs([]), '');
  assert.equal(listLangs(['time']), 'Time');
  assert.equal(listLangs(['words', 'time']), 'Words and Time');
  assert.equal(listLangs(['words', 'acts', 'time']), 'Words, Acts and Time');
});

test('unknown languages on an entry are ignored', () => {
  const stats = computeStats([monkeyOnly('a', 'snacks'), monkeyOnly('b', 'acts')]);
  assert.equal(stats.monkeyTotal, 1, 'only the valid half counts');
  assert.equal(stats.monkey.acts, 1);
});
