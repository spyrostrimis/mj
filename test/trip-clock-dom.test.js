// The hidden clock, rendered for real in jsdom.
//
// Two things have to hold, and only one of them is about behaviour:
//
//   1. Clicking the status bar clock opens the trip sheet.
//   2. Nothing about that element says it can be clicked. No pointer cursor,
//      no tooltip, no focus ring, no tab stop, no colour of its own. This is
//      the actual requirement - a tell is the bug.
//
// The clock lives only in the scaled frame, which renders at >= 720px. Below
// that the app is full-bleed and the status bar belongs to the real phone, so
// these tests mount wide on purpose.
//
// jsdom does no layout: nothing here asserts geometry, only DOM state, focus
// and the inline styles the components set.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { setupDom, stubFetch, render, click, pressKey, settle, act } from './helpers/dom.js';
import { App } from '../src/Shell.jsx';
import { TODAY_ISO } from '../src/data.js';
import { SHOWN_TRIP, SHOWN_CLOCK, tripDateLabel, photoFor, photosOf } from '../src/trips.js';

const same = (a, b, message) => assert.ok(a === b, message);
const absent = (value, message) => assert.ok(value === null || value === undefined, message);

const FIXTURE = () => ([
  {
    id: 'm-test-1', pairId: null, date: TODAY_ISO, time: '09:15',
    monkey: { id: 'm-test-1', lang: 'gifts', text: 'TEST FAKE - lone monkey half' },
    turtle: null,
  },
]);

// Wide enough for the scaled iOS frame, which is the only layout that has a
// fake status bar in it.
async function mount({ width = 1200, height = 1000 } = {}) {
  const dom = setupDom({ width, height });
  const calls = stubFetch(FIXTURE());
  const view = await render(React.createElement(App));
  const { container } = view;

  const q = (sel) => container.querySelector(sel);
  const all = (sel) => [...container.querySelectorAll(sel)];

  const ui = {
    container,
    clock: () => q('[data-clock]'),
    sheet: () => q('[data-trip-sheet]'),
    backdrop: () => q('[data-trip-backdrop]'),
    closeBtn: () => q('[data-trip-sheet]').querySelector('button'),
    photo: () => q('[data-trip-sheet] img'),
    photoFrame: () => q('[data-photo-frame]'),
    // jsdom loads no images, so the browser's half of this is faked: give the
    // element the dimensions a real decode would have produced, then fire the
    // load React is listening for.
    async loadPhotoAs(naturalWidth, naturalHeight) {
      const img = ui.photo();
      for (const [key, value] of [['naturalWidth', naturalWidth], ['naturalHeight', naturalHeight]]) {
        Object.defineProperty(img, key, { value, configurable: true });
      }
      await act(async () => {
        img.dispatchEvent(new dom.window.Event('load', { bubbles: false }));
      });
    },
    fab: () => all('button').find((b) => b.getAttribute('aria-label') === 'Log a moment'),
    // The wide frame wraps the whole app in a scale() transform, and that
    // wrapper contains the composer's text as well - so match the panel by the
    // transform that actually parks it, not by having one at all.
    composer: () => all('div').find((d) =>
      d.textContent.includes('New moment') && /translateY/.test(d.style.transform)),
    active: () => dom.window.document.activeElement,
    async done() {
      await view.unmount();
      calls.restore();
      dom.teardown();
    },
  };
  return ui;
}

test('the status bar shows a trip date wearing a clock', async () => {
  const ui = await mount();
  try {
    const clock = ui.clock();
    assert.ok(clock, 'the clock is in the frame');
    assert.equal(clock.textContent, SHOWN_CLOCK, 'it shows the trip picked for this load');
    assert.match(clock.textContent, /^(1[0-2]|[1-9]):[0-5]\d$/, 'and it reads as a time');
  } finally { await ui.done(); }
});

test('nothing about the clock says it can be clicked', async () => {
  const ui = await mount();
  try {
    const clock = ui.clock();

    assert.equal(clock.tagName, 'SPAN',
      'a button would bring a focus ring, a tab stop and a screen-reader ' +
      'announcement with it');
    assert.equal(clock.getAttribute('title'), null, 'a title attribute is a tooltip');
    assert.equal(clock.getAttribute('tabindex'), null, 'not in the tab order');
    assert.equal(clock.getAttribute('role'), null, 'and nothing announces it');
    assert.equal(clock.style.cursor, 'default',
      'the pointer cursor is the loudest tell there is');

    // It has to look like the 9:41 it replaced, which means adding no colour,
    // weight or size of its own - all of that is inherited from the bar.
    for (const prop of ['color', 'fontSize', 'fontWeight', 'textDecoration', 'opacity']) {
      assert.equal(clock.style[prop], '', 'the clock must not set ' + prop);
    }

    // Positive control: the app's real tap targets do all of the above, so
    // these assertions can tell a hidden thing from a visible one.
    const fab = ui.fab();
    assert.equal(fab.tagName, 'BUTTON');
    assert.equal(fab.style.cursor, 'pointer');
    assert.ok(fab.getAttribute('aria-label'), 'and it announces itself');
  } finally { await ui.done(); }
});

test('clicking the clock opens the trip, with its place, date and photo', async () => {
  const ui = await mount();
  try {
    absent(ui.sheet(), 'nothing is open to begin with');

    await click(ui.clock());

    const sheet = ui.sheet();
    assert.ok(sheet, 'the sheet is mounted');
    assert.equal(sheet.getAttribute('role'), 'dialog');
    assert.match(sheet.style.transform, /translateY\(0\)/, 'and it has actually slid up');

    assert.ok(sheet.textContent.includes(SHOWN_TRIP.place), 'the place is shown');
    assert.ok(sheet.textContent.includes(tripDateLabel(SHOWN_TRIP)),
      'and the date the clock was hiding');
    assert.equal(ui.photo().getAttribute('src'), photoFor(SHOWN_TRIP));

    // The panel takes focus, not Close - a ring around the button the instant
    // the sheet opens makes the thing you are meant to ignore the loudest
    // thing on screen.
    same(ui.active(), sheet, 'the panel holds focus');
    assert.equal(sheet.style.outline, 'none', 'and shows nothing for it');
  } finally { await ui.done(); }
});

test('Close, Escape and the backdrop all shut it', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());
    await click(ui.closeBtn());
    absent(ui.sheet().getAttribute('role'), 'Close shuts it');

    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    await click(ui.clock());
    await pressKey('Escape');
    absent(ui.sheet().getAttribute('role'), 'Escape shuts it');

    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    await click(ui.clock());
    await click(ui.backdrop());
    absent(ui.sheet().getAttribute('role'), 'the backdrop shuts it');
  } finally { await ui.done(); }
});

test('the sheet slides out before it leaves the DOM, inert while it does', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());
    const opened = ui.sheet();

    await click(ui.closeBtn());
    const closing = ui.sheet();
    same(closing, opened, 'the same node, or there is nothing to transition from');
    assert.match(closing.style.transform, /translateY\(100%\)/, 'sliding down');
    assert.equal(closing.getAttribute('aria-hidden'), 'true');
    assert.equal(closing.style.pointerEvents, 'none');
    assert.equal(closing.querySelector('button').getAttribute('tabindex'), '-1',
      'out of the tab order on the way');

    // And then it actually goes - parking a sheet below the fold forever is
    // what displaced the app once already.
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    absent(ui.sheet(), 'gone once the slide is done');
  } finally { await ui.done(); }
});

test('Tab reaches Close and then cannot walk out', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());
    const close = ui.closeBtn();

    // Nothing is highlighted to begin with...
    assert.ok(ui.active() !== close, 'Close does not start focused');

    // ...but a keyboard user gets there on the first Tab, and that is the
    // moment a focus ring is worth drawing.
    await pressKey('Tab');
    same(ui.active(), close, 'Tab lands on Close');
    await pressKey('Tab');
    same(ui.active(), close, 'and stays inside the sheet');
    await pressKey('Tab', { shiftKey: true });
    same(ui.active(), close, 'backwards too');
  } finally { await ui.done(); }
});

test('the trip sheet never takes focus without preventScroll', async () => {
  const ui = await mount();
  const proto = globalThis.HTMLElement.prototype;
  const original = proto.focus;
  const options = [];
  proto.focus = function patched(opts) { options.push(opts); return original.call(this, opts); };

  try {
    await click(ui.clock());
    await pressKey('Tab');
    await click(ui.closeBtn());

    assert.ok(options.length > 0, 'focus was actually called, so this is not vacuous');
    for (const opts of options) {
      assert.equal(opts?.preventScroll, true,
        'a plain focus() lets the browser scroll the clipped frame, which drags ' +
        'the parked composer into view');
    }
  } finally {
    proto.focus = original;
    await ui.done();
  }
});

test('the composer stays parked while the trip sheet is open', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());

    const composer = ui.composer();
    assert.ok(composer, 'the composer is mounted, as it always is');
    assert.match(composer.style.transform, /translateY\(100%\)/,
      'it must stay below the fold when the trip sheet opens');

    // Positive control: the FAB really does open it.
    await click(ui.closeBtn());
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    await click(ui.fab());
    assert.match(ui.composer().style.transform, /translateY\(0\)/);
  } finally { await ui.done(); }
});

test('the phone layout has no clock to find', async () => {
  // Below 720px the app is full-bleed: the status bar up there belongs to the
  // real phone, so there is nothing of ours to hide a trip in.
  const ui = await mount({ width: 420, height: 860 });
  try {
    absent(ui.clock(), 'no fake status bar, no clock');
    absent(ui.sheet(), 'and no way to open the sheet');
    assert.ok(ui.fab(), 'but the app itself is there - this is not an empty render');
  } finally { await ui.done(); }
});

test('the photo frame takes the shape of the photo in it', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());

    // Before anything has loaded there is nothing to measure, so the frame
    // keeps the 4:3 it has always drawn.
    assert.match(ui.photoFrame().style.aspectRatio, /^1\.3+ \/ 1$/,
      'the default shape until a photo says otherwise');

    await ui.loadPhotoAs(600, 800);
    assert.equal(ui.photoFrame().style.aspectRatio, '0.75 / 1',
      'a portrait photo gets a portrait frame, so nothing is cropped off it');
  } finally { await ui.done(); }
});

test('a photo too tall for the sheet is trimmed rather than allowed to take over', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());
    await ui.loadPhotoAs(1080, 1920);
    assert.equal(ui.photoFrame().style.aspectRatio, '0.75 / 1',
      'a 9:16 screenshot stops at 3:4');

    // Positive control in the same run: a shape inside the range really is
    // passed through untouched, so the clamp is not just pinning everything.
    await ui.loadPhotoAs(1000, 500);
    assert.equal(ui.photoFrame().style.aspectRatio, '2 / 1');
  } finally { await ui.done(); }
});

test('the photo is one of that trip s own, and does not change under an open sheet', async () => {
  const ui = await mount();
  try {
    await click(ui.clock());
    const src = ui.photo().getAttribute('src');
    assert.ok(photosOf(SHOWN_TRIP).includes(src), src + ' must belong to ' + SHOWN_TRIP.place);

    // Re-rendering the sheet must not reshuffle it - a photo swapping itself
    // while someone is looking at it is the bug the memo exists to stop.
    await pressKey('Tab');
    assert.equal(ui.photo().getAttribute('src'), src, 'unchanged across a re-render');

    // And still the same after closing and opening again in the same session.
    await click(ui.closeBtn());
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    await click(ui.clock());
    assert.equal(ui.photo().getAttribute('src'), src, 'unchanged across a reopen');
  } finally { await ui.done(); }
});
