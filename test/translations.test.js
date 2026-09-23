// The translation table: what Turtle answers each of Monkey's languages with,
// read only from moments that hold both halves.

import test from 'node:test';
import assert from 'node:assert/strict';

import { translations, listLangs } from '../src/data.js';

const both = (m, t) => ({ monkey: { lang: m }, turtle: { lang: t } });
const lone = (m) => ({ monkey: { lang: m }, turtle: null });

test('each language he gives maps to the answer given most often', () => {
  const rows = translations([
    both('words', 'time'), both('words', 'time'), both('words', 'acts'),
    both('touch', 'acts'),
  ]);
  assert.deepEqual(rows, [
    { give: 'words', answers: ['time'], n: 2 },
    { give: 'touch', answers: ['acts'], n: 1 },
  ]);
});

test('a tied answer names every answer, not the first one seen', () => {
  const rows = translations([both('gifts', 'time'), both('gifts', 'words')]);
  assert.deepEqual(rows, [{ give: 'gifts', answers: ['words', 'time'], n: 1 }]);
  assert.equal(listLangs(rows[0].answers, 'or'), 'Words or Time');
});

test('a lone half is no answer to anything', () => {
  const rows = translations([lone('words'), lone('words'), both('touch', 'acts')]);
  assert.deepEqual(rows.map(r => r.give), ['touch'], 'positive control: the pair still counts');
  assert.deepEqual(translations([lone('words')]), []);
});

test('the strongest rows come first, and only three of them', () => {
  const rows = translations([
    both('words', 'acts'),
    both('acts', 'acts'), both('acts', 'acts'),
    both('touch', 'acts'), both('touch', 'acts'), both('touch', 'acts'),
    both('gifts', 'acts'), both('gifts', 'acts'),
    both('time', 'acts'),
  ]);
  assert.deepEqual(rows.map(r => [r.give, r.n]), [['touch', 3], ['acts', 2], ['gifts', 2]]);
});
