// The quiet line: which languages a side has used least over the last 30
// days. Every case pins its own "today".

import test from 'node:test';
import assert from 'node:assert/strict';

import { quietLangs } from '../src/data.js';

const TODAY = '2026-09-23';
const moment = (date, m, t) => ({
  id: date + m + t, date,
  monkey: m ? { lang: m } : null,
  turtle: t ? { lang: t } : null,
});

// Monkey has used four of five lately, gifts not at all.
const FOUR_OF_FIVE = [
  moment('2026-09-23', 'words', 'acts'),
  moment('2026-09-20', 'acts', 'acts'),
  moment('2026-09-10', 'touch', 'time'),
  moment('2026-08-25', 'time', null),
];

test('the one language a side has not used lately is the quiet one', () => {
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'monkey', TODAY), ['gifts']);
});

test('lately is the last 30 days, today included', () => {
  // 2026-08-25 is day 30 counting back from today; 2026-08-24 is day 31.
  const inside = [...FOUR_OF_FIVE, moment('2026-08-25', 'gifts', null)];
  const outside = [...FOUR_OF_FIVE, moment('2026-08-24', 'gifts', null)];
  const levelled = quietLangs(inside, 'monkey', TODAY);
  assert.deepEqual(levelled, [], 'on day 30 gifts counts, so every language is level');
  assert.deepEqual(quietLangs(outside, 'monkey', TODAY), ['gifts'], 'day 31 does not count');
});

test('two tied at the bottom are both named; three are too many', () => {
  const two = [
    moment('2026-09-20', 'words', null), moment('2026-09-20', 'words', null),
    moment('2026-09-21', 'acts', null), moment('2026-09-22', 'touch', null),
  ];
  assert.deepEqual(quietLangs(two, 'monkey', TODAY), ['gifts', 'time']);

  const three = [moment('2026-09-20', 'words', null), moment('2026-09-21', 'acts', null)];
  assert.deepEqual(quietLangs(three, 'monkey', TODAY), []);
});

test('each side is read on its own, and both reads them together', () => {
  // Turtle has used acts and time only; Monkey fills in the rest.
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'turtle', TODAY), [], 'three unused is too many');
  assert.deepEqual(quietLangs(FOUR_OF_FIVE, 'both', TODAY), ['gifts']);
});

test('nothing logged lately means nothing to say', () => {
  assert.deepEqual(quietLangs([moment('2026-01-01', 'words', null)], 'monkey', TODAY), []);
  assert.deepEqual(quietLangs([], 'both', TODAY), []);
});
