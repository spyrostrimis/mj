// The date-as-a-clock mapping.
//
// The whole disguise rests on one claim: every showable trip date renders as a
// time a phone could actually display. These tests hold that claim down.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRIPS, FALLBACK_CLOCK, SILENT_TAP,
  isShowable, clockFor, tripDateLabel, pickTrip,
} from '../src/trips.js';
import { photoRatio, DEFAULT_RATIO } from '../src/TripSheet.jsx';

const trip = (date, extra = {}) => ({ date, place: 'Nowhere', ...extra });

test('a date becomes a clock: month in the hour, day in the minutes', () => {
  assert.equal(clockFor(trip('2026-09-21')), '9:21');
  assert.equal(clockFor(trip('2026-05-08')), '5:08', 'the day keeps its leading zero');
  assert.equal(clockFor(trip('2026-01-01')), '1:01', 'the hour loses its own');
  assert.equal(clockFor(trip('2026-12-31')), '12:31');
});

test('every showable date passes for a real time', () => {
  // The claim in trips.js: months are 1-12, which is exactly what a 12-hour
  // clock shows, and days are 1-31, which are all valid minutes. Walked in
  // full rather than sampled, because one 0:xx or 19:xx gives the game away.
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 31; d++) {
      const iso = '2026-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const clock = clockFor(trip(iso));
      const [hh, mm] = clock.split(':');
      assert.match(clock, /^(1[0-2]|[1-9]):[0-5]\d$/, iso + ' rendered as ' + clock);
      assert.equal(Number(hh), m);
      assert.equal(Number(mm), d);
    }
  }
});

test('a date that would not pass for a time is dropped, not shown', () => {
  const bad = [
    trip('2026-13-02'), trip('2026-00-02'),   // 13:xx and 0:xx are the tells
    trip('2026-09-32'), trip('2026-09-00'),   // :32 and :00 are not days
    trip('21/09/2026'), trip(''), trip(undefined),
    { date: '2026-09-21', place: '   ' },     // no place, nothing to show
  ];
  for (const t of bad) {
    assert.equal(isShowable(t), false, JSON.stringify(t?.date) + ' must not be showable');
    assert.equal(clockFor(t), FALLBACK_CLOCK, 'and falls back to the stock time');
  }

  // Positive control on the same fixture shape, so the loop above is not just
  // rejecting everything.
  assert.equal(isShowable(trip('2026-09-21')), true);
  assert.notEqual(clockFor(trip('2026-09-21')), FALLBACK_CLOCK);

  assert.equal(pickTrip(bad), null, 'a list of nothing showable picks nothing');
  assert.equal(pickTrip([]), null);
  assert.equal(pickTrip(null), null);
});

test('the label spells out the date the clock was hiding', () => {
  assert.equal(tripDateLabel(trip('2026-09-21')), 'Sep 21 · 2026');
  assert.equal(tripDateLabel(trip('2025-01-05')), 'Jan 5 · 2025');
  assert.equal(tripDateLabel(trip('2026-13-01')), '', 'nothing to spell out');
});

test('pickTrip reaches every trip and never falls off the end', () => {
  const list = [trip('2026-01-02'), trip('2026-03-04'), trip('2026-05-06')];

  assert.equal(pickTrip(list, () => 0), list[0]);
  assert.equal(pickTrip(list, () => 0.5), list[1]);
  assert.equal(pickTrip(list, () => 0.999), list[2]);
  // Math.random() is documented as < 1, but an exact 1 must not index past
  // the array and hand the frame `undefined`.
  assert.equal(pickTrip(list, () => 1), list[2]);
});

test('pickTrip only ever offers a showable trip', () => {
  const list = [trip('2026-13-01'), trip('2026-07-04'), trip('bad')];
  for (let i = 0; i < 50; i++) {
    assert.equal(pickTrip(list), list[1], 'the two unusable ones are never chosen');
  }
});

test('the shipped list is usable as written', () => {
  assert.ok(TRIPS.length > 0, 'something to show');
  for (const t of TRIPS) {
    assert.ok(isShowable(t), t.place + ' must render as a plausible time');
  }
});



test('the silent tap style gives nothing away', () => {
  assert.equal(SILENT_TAP.cursor, 'default', 'a pointer is the loudest tell');
  // It must inherit everything visible, so a hinted span looks exactly like
  // the prose around it.
  for (const prop of ['color', 'fontSize', 'fontWeight', 'textDecoration', 'opacity', 'background']) {
    assert.equal(SILENT_TAP[prop], undefined, 'SILENT_TAP must not set ' + prop);
  }
});

test('a photo is shown at its own shape, clamped only at the extremes', () => {
  // Inside the range the ratio is the photo's own, to the pixel: nothing is
  // cropped, which is the whole point of measuring it.
  assert.equal(photoRatio(800, 600), 4 / 3, 'ordinary landscape');
  assert.equal(photoRatio(600, 800), 3 / 4, 'ordinary portrait, untouched');
  assert.equal(photoRatio(1000, 500), 2, 'wide, right on the limit');
  assert.equal(photoRatio(900, 900), 1, 'square');

  // Outside it, the clamp takes over - a 9:16 screenshot would otherwise push
  // the place and the date off the sheet.
  assert.equal(photoRatio(1080, 1920), 3 / 4, 'a 9:16 photo is trimmed to 3:4');
  assert.equal(photoRatio(3000, 1000), 2, 'a panorama is trimmed to 2:1');

  // Never outside the range, whatever it is handed.
  for (const [w, h] of [[1, 5000], [5000, 1], [1, 1], [16, 9], [9, 16]]) {
    const r = photoRatio(w, h);
    assert.ok(r >= 3 / 4 && r <= 2, w + 'x' + h + ' gave ' + r);
  }
});

test('a photo with nothing to measure keeps the frame it always had', () => {
  for (const [w, h] of [[0, 0], [800, 0], [0, 600], [NaN, NaN], [-800, 600]]) {
    assert.equal(photoRatio(w, h), DEFAULT_RATIO, w + 'x' + h + ' falls back');
  }
  assert.equal(photoRatio(undefined, undefined), DEFAULT_RATIO);

  // Positive control: a real measurement does move it off the default.
  assert.notEqual(photoRatio(600, 800), DEFAULT_RATIO);
});
