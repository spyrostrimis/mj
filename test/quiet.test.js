// The quiet line: which languages a side has used least, over whatever
// moments it is handed - the period on screen.

import test from 'node:test';
import assert from 'node:assert/strict';

import { quietLangs } from '../src/data.js';

const moment = (m, t) => ({
  monkey: m ? { lang: m } : null,
  turtle: t ? { lang: t } : null,
});

// Monkey has used four of five, gifts not at all.
const FOUR_OF_FIVE = [
  moment('words', 'acts'),
  moment('acts', 'acts'),
  moment('touch', 'time'),
  moment('time', null),
];

test('the one language a side has not used is the quiet one', () => {
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'monkey'), ['gifts']);
});

test('every moment handed in counts, whatever its date', () => {
  // The window is the caller's period now; quietLangs keeps no clock of its own.
  const old = { date: '2000-01-01', monkey: { lang: 'gifts' }, turtle: null };
  assert.deepEqual(quietLangs([...FOUR_OF_FIVE, old], 'monkey'), [],
    'gifts from 2000 levels every language');
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'monkey'), ['gifts'], 'positive control');
});

test('two tied at the bottom are both named; three are too many', () => {
  const two = [moment('words'), moment('words'), moment('acts'), moment('touch')];
  assert.deepEqual(quietLangs(two, 'monkey'), ['gifts', 'time']);

  const three = [moment('words'), moment('acts')];
  assert.deepEqual(quietLangs(three, 'monkey'), []);
});

test('each side is read on its own, and both reads them together', () => {
  // Turtle has used acts and time only; Monkey fills in the rest.
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'turtle'), [], 'three unused is too many');
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'both'), ['gifts']);
});

test('every language level, or nothing logged, means nothing to say', () => {
  const level = ['words', 'acts', 'touch', 'gifts', 'time'].map(l => moment(null, l));
  assert.deepEqual(quietLangs(level, 'turtle'), []);
  assert.deepEqual(quietLangs([], 'both'), []);
});
