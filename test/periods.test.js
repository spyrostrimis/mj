// The windows Insights reads over. Every case pins its own "today", so none of
// this depends on the day the suite happens to run.

import test from 'node:test';
import assert from 'node:assert/strict';

import { periodStart, inPeriod } from '../src/data.js';

const WED = '2026-09-23';

test('each period starts where the calendar says it does', () => {
  assert.equal(periodStart('week', WED), '2026-09-20', 'the Sunday before');
  assert.equal(periodStart('month', WED), '2026-09-01');
  assert.equal(periodStart('year', WED), '2026-01-01');
  assert.equal(periodStart('all', WED), null);
});

test('a Sunday starts its own week', () => {
  assert.equal(periodStart('week', '2026-09-20'), '2026-09-20');
  assert.equal(periodStart('week', '2026-09-19'), '2026-09-13', 'Saturday is the end of the one before');
});

test('a week can reach back into last month and last year', () => {
  assert.equal(periodStart('week', '2026-10-02'), '2026-09-27');
  assert.equal(periodStart('week', '2026-01-02'), '2025-12-28');
});

test('inPeriod keeps the first day and drops the day before it', () => {
  const on = (date) => ({ id: date, date });
  const entries = [on('2026-09-19'), on('2026-09-20'), on('2026-09-23')];
  assert.deepEqual(inPeriod(entries, 'week', WED).map(e => e.date), ['2026-09-20', '2026-09-23']);
  assert.equal(inPeriod(entries, 'all', WED).length, 3, 'positive control: all time keeps everything');
});
