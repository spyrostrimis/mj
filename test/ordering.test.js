// Same-minute ordering: a moment saved second must sit above the one saved
// first, even when both carry the same date and the same HH:MM.
//
// This was broken in three places at once, and none of them was caught by the
// 107 tests that existed, because nothing asserted on order at all.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newestFirst, sortDesc, groupByDate } from '../src/data.js';

const at = (id, date, time) => ({ id, date, time });

// A list already in the order the feed wants: newest first.
const newestFirstList = (n, date, time) =>
  Array.from({ length: n }, (_, i) => at(String(n - 1 - i), date, time));

const ids = (list) => list.map((e) => e.id).join(',');

test('newestFirst returns 0 for the same date and time', () => {
  const a = at('a', '2026-09-15', '17:57');
  const b = at('b', '2026-09-15', '17:57');

  assert.equal(newestFirst(a, b), 0);
  assert.equal(newestFirst(b, a), 0);
});

// The positive control for the test above: a comparator that returned 0 for
// everything would pass it. These prove it still discriminates.
test('newestFirst still puts a later date, and a later time, first', () => {
  const older = at('older', '2026-09-14', '17:57');
  const newer = at('newer', '2026-09-15', '17:57');
  assert.ok(newestFirst(newer, older) < 0, 'later date sorts first');
  assert.ok(newestFirst(older, newer) > 0, 'earlier date sorts last');

  const early = at('early', '2026-09-15', '09:00');
  const late  = at('late',  '2026-09-15', '17:57');
  assert.ok(newestFirst(late, early) < 0, 'later time sorts first');
  assert.ok(newestFirst(early, late) > 0, 'earlier time sorts last');
});

// The comparator has to be consistent, or the sort is free to do anything.
// The old one returned -1 for every tie, which claimed a before b AND b
// before a, and reversed the whole run.
test('newestFirst never disagrees with itself', () => {
  // A mix of ties and non-ties, so this covers both branches.
  const list = [
    at('a', '2026-09-15', '17:57'),
    at('b', '2026-09-15', '17:57'),
    at('c', '2026-09-15', '09:00'),
    at('d', '2026-09-14', '17:57'),
  ];

  for (const a of list) {
    for (const b of list) {
      const ab = Math.sign(newestFirst(a, b));
      const ba = Math.sign(newestFirst(b, a));
      // Summed rather than compared as ab === -ba: Object.is(0, -0) is false,
      // and a tie produces 0 on one side and -0 on the other.
      assert.equal(ab + ba, 0, `cmp(${a.id},${b.id})=${ab}, cmp(${b.id},${a.id})=${ba}`);
    }
  }
});

// Sizes chosen to cross V8's sort implementation boundary (insertion sort up
// to 22 elements, TimSort above it), because the old comparator behaved
// differently on either side and "it looks right" depended on the count.
test('sortDesc leaves a same-minute run exactly as it found it', () => {
  for (const n of [2, 3, 5, 8, 10, 22, 23, 40]) {
    const input = newestFirstList(n, '2026-09-15', '17:57');
    assert.equal(ids(sortDesc(input)), ids(input), `n=${n} was reordered`);
  }
});

test('sortDesc still sorts by date and time', () => {
  const scrambled = [
    at('c', '2026-09-14', '20:00'),
    at('a', '2026-09-15', '17:57'),
    at('d', '2026-09-14', '08:00'),
    at('b', '2026-09-15', '09:00'),
  ];
  assert.equal(ids(sortDesc(scrambled)), 'a,b,c,d');
});

test('sortDesc does not mutate its input', () => {
  const input = newestFirstList(4, '2026-09-15', '17:57');
  const before = ids(input);
  sortDesc(input);
  assert.equal(ids(input), before);
});

// The bug as it was actually seen: save a moment at 17:57 when one is already
// there, and watch it land underneath. Shell prepends the new moment
// (Shell.jsx: setEntries(prev => [entry, ...prev])) and Today renders it
// through groupByDate.
test('a moment saved into the same minute stays on top of the feed', () => {
  const existing = [at('older', '2026-09-15', '17:57')];
  const optimistic = [at('NEW', '2026-09-15', '17:57'), ...existing];

  const [day] = groupByDate(optimistic);
  assert.equal(day.date, '2026-09-15');
  assert.equal(ids(day.entries), 'NEW,older');
});

test('groupByDate keeps the days themselves newest-first', () => {
  const entries = [
    at('a', '2026-09-14', '10:00'),
    at('b', '2026-09-15', '17:57'),
    at('c', '2026-09-15', '17:57'),
  ];
  const groups = groupByDate(entries);
  assert.deepEqual(groups.map((g) => g.date), ['2026-09-15', '2026-09-14']);
  assert.equal(ids(groups[0].entries), 'b,c');
});

// ---------------------------------------------------------------------------
// The Calendar day list, rendered for real.
//
// The Calendar keeps its own sorted copy in a useMemo, so the pure tests above
// say nothing about it. It is in jsdom rather than tested as a bare function
// because that memo is where the second copy of the comparator lived, and a
// pure test would have gone on passing while the screen kept its own.

import React from 'react';
import { setupDom, render } from './helpers/dom.js';
import { CalendarScreen } from '../src/Calendar.jsx';
import { TODAY_ISO } from '../src/data.js';

const loneMonkey = (id, time, text) => ({
  id, pairId: null, date: TODAY_ISO, time,
  monkey: { id, lang: 'acts', text },
  turtle: null,
});

// Which of two texts the DOM puts first. textContent is built in document
// order, so an index comparison is an order comparison - and it needs no
// geometry, which jsdom does not have.
const firstOf = (container, a, b) => {
  const ia = container.textContent.indexOf(a);
  const ib = container.textContent.indexOf(b);
  assert.ok(ia !== -1, `${a} was never rendered`);
  assert.ok(ib !== -1, `${b} was never rendered`);
  return ia < ib ? a : b;
};

const NEWER = 'TEST FAKE - saved second';
const OLDER = 'TEST FAKE - saved first';

async function mountCalendar(entries) {
  const dom = setupDom();
  const view = await render(
    React.createElement(CalendarScreen, {
      entries,
      onBack: () => {},
      onHalfTap: null,
      accent: '#8a7d6b',
    })
  );
  return {
    container: view.container,
    async done() {
      await view.unmount();
      dom.teardown();
    },
  };
}

test('the calendar day list keeps a same-minute moment on top', async () => {
  // Newest first, the order the app holds them in.
  const cal = await mountCalendar([
    loneMonkey('m-new', '17:57', NEWER),
    loneMonkey('m-old', '17:57', OLDER),
  ]);

  try {
    assert.equal(firstOf(cal.container, NEWER, OLDER), NEWER);
  } finally {
    await cal.done();
  }
});

// Positive control on the same fixture shape: the sort still has to do its
// actual job, or the test above would pass on a comparator that did nothing.
test('the calendar day list still puts a later time above an earlier one', async () => {
  const cal = await mountCalendar([
    loneMonkey('m-early', '09:00', OLDER),
    loneMonkey('m-late',  '17:57', NEWER),
  ]);

  try {
    assert.equal(firstOf(cal.container, NEWER, OLDER), NEWER);
  } finally {
    await cal.done();
  }
});
