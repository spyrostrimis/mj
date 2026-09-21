// The calendar's winks, rendered for real in jsdom.
//
// The phone has no fake status bar to hide a clock in, so the calendar carries
// the secret instead - and it needs no disguise, because a calendar is already
// a map of dates. What marks a trip day is the copy:
//
//   empty day  ->  "Nothing logged on this day. Or is it?"
//   busy day   ->  "not just 5 moments"
//
// and tapping those words opens the trip. The styling stays exactly what it
// was, so the wink is in the words and nowhere else.
//
// Nothing here hard-codes a date. Today is whatever day the suite runs on, and
// future days are unreachable in the grid, so each trip is located by its most
// recent past occurrence and the calendar is walked back to that month.
//
// jsdom does no layout: only DOM state, focus and inline styles are asserted.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { setupDom, stubFetch, render, click, pressKey, settle, act } from './helpers/dom.js';
import { App } from '../src/Shell.jsx';
import { TODAY_ISO, TODAY, MONTHS_LONG } from '../src/data.js';
import { TRIPS, tripForDate, tripDateLabel } from '../src/trips.js';

const absent = (value, message) => assert.ok(value === null || value === undefined, message);

const TRIP_BUSY  = TRIPS[0];   // gets fixture moments
const TRIP_EMPTY = TRIPS[1];   // deliberately left with none

// The most recent occurrence of this trip's month and day that is not in the
// future - the grid disables future cells, so this is the one we can select
// whatever today happens to be.
function pastOccurrence(trip) {
  const md = trip.date.slice(5);
  const y = Number(TODAY_ISO.slice(0, 4));
  return (md > TODAY_ISO.slice(5) ? y - 1 : y) + '-' + md;
}

// A selectable day in the same month as `iso` that belongs to no trip at all.
// Days 1-28 only, so the month always has them.
function plainDayIn(iso) {
  const ym = iso.slice(0, 8);
  for (let d = 1; d <= 28; d++) {
    const candidate = ym + String(d).padStart(2, '0');
    if (candidate > TODAY_ISO) continue;       // future days are disabled
    if (tripForDate(candidate)) continue;      // must be nobody's trip
    return candidate;
  }
  throw new Error('no plain day available in ' + ym);
}

const BUSY_DAY  = pastOccurrence(TRIP_BUSY);
const EMPTY_DAY = pastOccurrence(TRIP_EMPTY);
const PLAIN_BUSY_DAY  = plainDayIn(BUSY_DAY);
const PLAIN_EMPTY_DAY = plainDayIn(EMPTY_DAY);

const moment = (id, date, time) => ({
  id, pairId: null, date, time,
  monkey: { id, lang: 'gifts', text: 'TEST FAKE - ' + id },
  turtle: null,
});

const FIXTURE = () => ([
  moment('m-busy-1', BUSY_DAY, '11:30'),
  moment('m-busy-2', BUSY_DAY, '09:15'),
  moment('m-plain-1', PLAIN_BUSY_DAY, '14:00'),
]);

async function mount({ width = 420, height = 860 } = {}) {
  const dom = setupDom({ width, height });
  const calls = stubFetch(FIXTURE());
  const view = await render(React.createElement(App));
  const { container } = view;

  const q = (sel) => container.querySelector(sel);
  const all = (sel) => [...container.querySelectorAll(sel)];

  const ui = {
    container,
    tab: (label) => [...q('[data-tabs]').querySelectorAll('button')]
      .find((b) => b.textContent.trim() === label),
    monthLabel: () => all('div').map((d) => d.textContent)
      .find((t) => /^[A-Z][a-z]+ \d{4}$/.test(t)),
    prevMonth: () => all('button').find((b) => b.getAttribute('aria-label') === 'Previous month'),
    nextMonth: () => all('button').find((b) => b.getAttribute('aria-label') === 'Next month'),
    dayCell: (iso) => q('[aria-label="' + iso + '"]'),
    hint: () => q('[data-trip-hint]'),
    // The day panel: the eyebrow and the count sit in one row above the list.
    panel: () => q('[data-scroll]'),
    sheet: () => q('[data-trip-sheet]'),
    closeBtn: () => q('[data-trip-sheet]').querySelector('button'),
    sheets: () => all('[data-trip-sheet]'),
    async openCalendar() { await click(ui.tab('Calendar')); },
    // Walks from whatever month is on screen, not from today - a second
    // select() in the same test starts wherever the first one left it.
    async goToMonth(iso) {
      const [y, m] = iso.split('-').map(Number);
      const want = y * 12 + (m - 1);
      assert.ok(want <= TODAY.y * 12 + TODAY.m, 'targets are never in the future');

      const here = () => {
        const [name, year] = ui.monthLabel().split(' ');
        return Number(year) * 12 + MONTHS_LONG.indexOf(name);
      };
      // Bounded so a broken button fails the test instead of spinning forever.
      for (let guard = 0; here() !== want && guard < 400; guard++) {
        await click(here() > want ? ui.prevMonth() : ui.nextMonth());
      }
      assert.equal(ui.monthLabel(), MONTHS_LONG[m - 1] + ' ' + y, 'landed on the right month');
    },
    async select(iso) {
      await ui.goToMonth(iso);
      const cell = ui.dayCell(iso);
      assert.ok(cell, 'the grid has a cell for ' + iso);
      assert.ok(!cell.disabled, iso + ' must be selectable');
      await click(cell);
    },
    async done() {
      await view.unmount();
      calls.restore();
      dom.teardown();
    },
  };
  return ui;
}

test('an empty trip day asks the question, an ordinary one does not', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);

    assert.match(ui.panel().textContent, /Nothing logged on this day\.\s*Or is it\?/,
      'the wink is appended to the line that was already there');
    assert.ok(ui.hint(), 'and it is tappable');
    assert.equal(ui.hint().textContent, 'Or is it?');

    // Positive control on the same run: an ordinary empty day keeps the plain
    // sentence, so the wink really is tied to the date.
    await ui.select(PLAIN_EMPTY_DAY);
    assert.match(ui.panel().textContent, /Nothing logged on this day\./);
    assert.doesNotMatch(ui.panel().textContent, /Or is it\?/);
    absent(ui.hint(), 'no hint on a day that hides nothing');
  } finally { await ui.done(); }
});

test('a busy trip day counts differently', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(BUSY_DAY);

    assert.match(ui.panel().textContent, /not just 2 moments/,
      'the count is still true - it is just not the whole truth');
    assert.equal(ui.hint().textContent, 'not just 2 moments');

    // Positive control: an ordinary day with moments counts them plainly, and
    // the singular still reads right.
    await ui.select(PLAIN_BUSY_DAY);
    assert.match(ui.panel().textContent, /1 moment/);
    assert.doesNotMatch(ui.panel().textContent, /not just/);
    absent(ui.hint(), 'no hint on a day that hides nothing');
  } finally { await ui.done(); }
});

test('nothing about the wink says it can be tapped', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);
    const hint = ui.hint();

    assert.equal(hint.tagName, 'SPAN',
      'a button would bring a focus ring and a tab stop with it');
    assert.equal(hint.getAttribute('title'), null, 'a title attribute is a tooltip');
    assert.equal(hint.getAttribute('tabindex'), null, 'not in the tab order');
    assert.equal(hint.getAttribute('role'), null, 'and nothing announces it');
    assert.equal(hint.style.cursor, 'default', 'no pointer cursor');

    // It has to read as part of the sentence, so it sets nothing visible of
    // its own - colour, size and style are all inherited.
    for (const prop of ['color', 'fontSize', 'fontWeight', 'textDecoration', 'opacity']) {
      assert.equal(hint.style[prop], '', 'the wink must not set ' + prop);
    }

    // Positive control: the day cells right above it are proper buttons.
    const cell = ui.dayCell(EMPTY_DAY);
    assert.equal(cell.tagName, 'BUTTON');
    assert.equal(cell.style.cursor, 'pointer');
  } finally { await ui.done(); }
});

test('tapping the wink opens that day s trip', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);
    absent(ui.sheet(), 'nothing is open yet');

    await click(ui.hint());

    const sheet = ui.sheet();
    assert.ok(sheet, 'the trip is up');
    assert.equal(sheet.getAttribute('role'), 'dialog');
    assert.match(sheet.style.transform, /translateY\(0\)/, 'and it has actually slid up');
    assert.ok(sheet.textContent.includes(TRIP_EMPTY.place), 'the right place');
    assert.ok(sheet.textContent.includes(tripDateLabel(TRIP_EMPTY)),
      'and the year it really happened, not the year being browsed');
  } finally { await ui.done(); }
});

test('the busy day s wink opens its own trip, not the other one', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(BUSY_DAY);
    await click(ui.hint());

    const text = ui.sheet().textContent;
    assert.ok(text.includes(TRIP_BUSY.place), 'the trip for the day that was tapped');
    assert.ok(!text.includes(TRIP_EMPTY.place), 'and not whichever one came first');
  } finally { await ui.done(); }
});

test('the trip is there in every year, not just its own', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();

    // A year further back than the trip's most recent occurrence. The clock
    // carries no year either, so neither does this.
    const [y, md] = [Number(EMPTY_DAY.slice(0, 4)) - 1, EMPTY_DAY.slice(5)];
    const earlier = y + '-' + md;
    assert.notEqual(earlier, TRIP_EMPTY.date, 'genuinely a different year');

    await ui.select(earlier);
    assert.match(ui.panel().textContent, /Or is it\?/, 'the same day, an earlier year');

    await click(ui.hint());
    assert.ok(ui.sheet().textContent.includes(TRIP_EMPTY.place));
    assert.ok(ui.sheet().textContent.includes(tripDateLabel(TRIP_EMPTY)),
      'still dated to the year it happened');
  } finally { await ui.done(); }
});

test('closing leaves the calendar exactly where it was', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);
    const month = ui.monthLabel();

    await click(ui.hint());
    await click(ui.closeBtn());

    absent(ui.sheet().getAttribute('role'), 'closed');
    assert.match(ui.sheet().style.transform, /translateY\(100%\)/, 'sliding out');
    assert.equal(ui.sheet().style.pointerEvents, 'none', 'and inert while it does');

    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    absent(ui.sheet(), 'gone once the slide is done');

    assert.equal(ui.monthLabel(), month, 'the same month is still showing');
    assert.match(ui.panel().textContent, /Or is it\?/, 'and the same day is still selected');
  } finally { await ui.done(); }
});

test('Escape closes the trip a calendar day opened', async () => {
  const ui = await mount();
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);
    await click(ui.hint());
    assert.ok(ui.sheet().getAttribute('role'), 'open first, so this is not vacuous');

    await pressKey('Escape');
    absent(ui.sheet().getAttribute('role'), 'Escape closes it');
  } finally { await ui.done(); }
});

test('the calendar carries the secret on desktop too', async () => {
  // The scaled frame has the status bar clock as well, so this also checks the
  // two sheets do not collide: only the calendar's is open.
  const ui = await mount({ width: 1200, height: 1000 });
  try {
    await ui.openCalendar();
    await ui.select(EMPTY_DAY);
    await click(ui.hint());

    assert.equal(ui.sheets().length, 1, 'one sheet open, not two');
    assert.ok(ui.sheet().textContent.includes(TRIP_EMPTY.place));
    assert.ok(ui.container.querySelector('[data-clock]'),
      'and the clock is still up there, untouched');
  } finally { await ui.done(); }
});
