// The half-actions sheet, rendered for real in jsdom.
//
// The bugs this covers both shipped to production while 89 tests stayed green,
// because nothing in this repo rendered React:
//
//   1. Tapping a half also revealed the composer. The phone frame clips with
//      overflow:hidden, which is still scrollable programmatically, and both
//      sheets park below the fold at translateY(100%). Focusing an element the
//      browser considers off-screen made it scroll the frame to reach it.
//   2. Delete displaced the whole app. close() handed focus back to the half
//      that opened the sheet; fire() handed it back nowhere, so focus stayed on
//      the Delete button as the panel slid off-screen and the browser chased it.
//
// jsdom does no layout, so nothing here asserts geometry - only DOM state,
// focus, and the inline styles the components set.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { setupDom, stubFetch, render, click, pressKey, settle, act } from './helpers/dom.js';
import { App } from '../src/Shell.jsx';
import { TODAY_ISO } from '../src/data.js';

const FIXTURE = () => ([
  {
    id: 'p-test-1', pairId: 'p-test-1', date: TODAY_ISO, time: '11:30',
    monkey: { id: 'm-test-1', lang: 'acts', text: 'TEST FAKE - monkey half of a pair' },
    turtle: { id: 't-test-1', lang: 'words', text: 'TEST FAKE - turtle half of a pair' },
  },
  {
    id: 'm-test-2', pairId: null, date: TODAY_ISO, time: '09:15',
    monkey: { id: 'm-test-2', lang: 'gifts', text: 'TEST FAKE - lone monkey half' },
    turtle: null,
  },
]);

async function mount() {
  const dom = setupDom();
  const calls = stubFetch(FIXTURE());
  const view = await render(React.createElement(App));
  const { container } = view;

  const q = (sel) => container.querySelector(sel);
  const all = (sel) => [...container.querySelectorAll(sel)];

  return {
    container,
    calls,
    deletes: () => calls.filter((c) => c.method === 'DELETE'),
    halves: () => all('.half-btn'),
    half: (text) => all('.half-btn').find((b) => b.textContent.includes(text)),
    dialog: () => q('[role="dialog"]'),
    backdrop: () => q('[role="dialog"]').previousElementSibling,
    sheetButton: (label) =>
      [...q('[role="dialog"]').querySelectorAll('button')]
        .find((b) => b.textContent.trim().startsWith(label)),
    fab: () => all('button').find((b) => b.getAttribute('aria-label') === 'Log a moment'),
    // The composer panel is the one carrying the New moment header. Matched
    // in source casing: the uppercase look is a CSS textTransform, which jsdom
    // does not apply to textContent.
    composer: () => all('div').find((d) => d.textContent.includes('New moment') && d.style.transform),
    clip: () => q('.frame-clip'),
    active: () => dom.window.document.activeElement,
    async done() {
      await view.unmount();
      calls.restore();
      dom.teardown();
    },
  };
}

test('tapping a half opens its actions, with Cancel holding focus', async () => {
  const ui = await mount();
  try {
    assert.equal(ui.dialog(), null, 'no sheet before the tap');
    assert.equal(ui.halves().length, 3, 'two halves of the pair plus the lone one');

    await click(ui.half('monkey half of a pair'));

    const sheet = ui.dialog();
    assert.ok(sheet, 'the sheet is mounted');
    assert.match(sheet.textContent, /Monkey's half/i);
    assert.match(sheet.textContent, /TEST FAKE - monkey half of a pair/,
      'it shows the half being acted on');

    // Cancel takes focus, never Delete: a destructive row must not be what a
    // stray Enter reaches.
    assert.equal(ui.active(), ui.sheetButton('Cancel'));
    assert.notEqual(ui.active(), ui.sheetButton('Delete'));
  } finally { await ui.done(); }
});

test('the lone half is told the moment goes with it', async () => {
  const ui = await mount();
  try {
    await click(ui.half('lone monkey half'));
    assert.match(ui.dialog().textContent, /The only half left/);

    // Positive control on the same run: the paired half says the other thing,
    // so this is a real branch and not one constant string.
    await click(ui.sheetButton('Cancel'));
    await click(ui.half('monkey half of a pair'));
    assert.match(ui.dialog().textContent, /This can.t be undone/);
    assert.doesNotMatch(ui.dialog().textContent, /The only half left/);
  } finally { await ui.done(); }
});

test('the composer stays parked while a half sheet is open', async () => {
  const ui = await mount();
  try {
    await click(ui.half('monkey half of a pair'));

    const composer = ui.composer();
    assert.ok(composer, 'the composer is mounted, as it always is');
    assert.match(composer.style.transform, /translateY\(100%\)/,
      'it must stay below the fold when a half sheet opens');
    assert.equal(composer.previousElementSibling.style.pointerEvents, 'none',
      'and stay inert');

    // Positive control: the FAB really does open it, so the assertion above
    // can tell an open composer from a closed one.
    await click(ui.sheetButton('Cancel'));
    await click(ui.fab());
    assert.match(ui.composer().style.transform, /translateY\(0\)/);
    assert.equal(ui.composer().previousElementSibling.style.pointerEvents, 'auto');
  } finally { await ui.done(); }
});

test('the sheet never takes focus without preventScroll', async () => {
  const ui = await mount();
  const proto = globalThis.HTMLElement.prototype;
  const original = proto.focus;
  const options = [];
  proto.focus = function patched(opts) { options.push(opts); return original.call(this, opts); };

  try {
    await click(ui.half('monkey half of a pair'));
    await click(ui.sheetButton('Cancel'));
    await click(ui.half('lone monkey half'));
    await click(ui.sheetButton('Delete'));

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

test('Delete leaves focus outside the sheet', async () => {
  const ui = await mount();
  try {
    await click(ui.half('monkey half of a pair'));
    await click(ui.sheetButton('Delete'));

    assert.equal(ui.dialog(), null, 'the sheet unmounts rather than parking below the fold');
    assert.ok(
      !ui.active()?.closest?.('[role="dialog"]'),
      'focus must not ride the sheet off-screen - that is what displaced the app'
    );

    assert.deepEqual(ui.deletes().map((c) => c.url), ['/api/entries/m-test-1?kind=half']);
    assert.equal(ui.half('monkey half of a pair'), undefined, 'that half is gone');

    // Positive control: the pair's other half is untouched, so Delete removed
    // one half and not the moment.
    assert.ok(ui.half('turtle half of a pair'), 'the other half survives');
  } finally { await ui.done(); }
});

test('Delete hands focus back before the sheet goes', async () => {
  // Distinct from the test above: because the sheet unmounts, focus falls to
  // the document on its own and "focus is not in the dialog" passes whether or
  // not fire() released it. This asserts the release itself - that focus is
  // handed back while the sheet is still mounted, which is the behaviour that
  // was missing when Delete displaced the app.
  const ui = await mount();
  const proto = globalThis.HTMLElement.prototype;
  const original = proto.focus;
  const focused = [];

  try {
    await click(ui.half('monkey half of a pair'));
    const tapped = ui.half('monkey half of a pair');
    const del = ui.sheetButton('Delete');

    proto.focus = function patched(opts) { focused.push(this); return original.call(this, opts); };
    await click(del);
    proto.focus = original;

    assert.ok(focused.length > 0, 'focus moved during the delete, so this is not vacuous');
    assert.ok(focused.includes(tapped),
      'fire() must release focus the way close() does - leaving it on the ' +
      'Delete button is what let the browser chase it below the frame');
    assert.ok(!focused.includes(del),
      'and it must not land back on the destructive row');
  } finally {
    proto.focus = original;
    await ui.done();
  }
});

test('Cancel hands focus back to the tapped half and deletes nothing', async () => {
  const ui = await mount();
  try {
    const tapped = ui.half('monkey half of a pair');
    await click(tapped);
    await click(ui.sheetButton('Cancel'));

    assert.equal(ui.dialog(), null);
    assert.equal(ui.active(), tapped, 'focus returns to where it came from');
    assert.deepEqual(ui.deletes(), []);
    assert.equal(ui.halves().length, 3, 'the feed is untouched');
  } finally { await ui.done(); }
});

test('Escape and the backdrop both cancel', async () => {
  const ui = await mount();
  try {
    const tapped = ui.half('monkey half of a pair');
    await click(tapped);
    await pressKey('Escape');
    assert.equal(ui.dialog(), null, 'Escape closes');
    assert.equal(ui.active(), tapped, 'and restores focus');

    await click(ui.half('lone monkey half'));
    await click(ui.backdrop());
    assert.equal(ui.dialog(), null, 'a backdrop click closes');

    assert.deepEqual(ui.deletes(), [], 'neither route deletes');
    assert.equal(ui.halves().length, 3);
  } finally { await ui.done(); }
});

test('Tab cycles between Cancel and Delete without leaving the sheet', async () => {
  const ui = await mount();
  try {
    await click(ui.half('monkey half of a pair'));
    const cancel = ui.sheetButton('Cancel');
    const del = ui.sheetButton('Delete');

    assert.equal(ui.active(), cancel, 'starts on Cancel');
    await pressKey('Tab');
    assert.equal(ui.active(), del);
    await pressKey('Tab');
    assert.equal(ui.active(), cancel, 'wraps rather than escaping to the feed');
    await pressKey('Tab', { shiftKey: true });
    assert.equal(ui.active(), del, 'and wraps backwards too');
  } finally { await ui.done(); }
});

test('Delete fires once when it is double-tapped', async () => {
  const ui = await mount();
  try {
    await click(ui.half('monkey half of a pair'));
    const del = ui.sheetButton('Delete');

    // Both clicks land before React re-renders, which is what a real
    // double-tap does. The latch, not the unmount, is what has to stop it.
    await act(async () => {
      del.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
      del.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await settle();

    assert.equal(ui.deletes().length, 1, 'one DELETE, not two');
  } finally { await ui.done(); }
});

test('the phone frame clips without being a scroller', async () => {
  const ui = await mount();
  try {
    const clip = ui.clip();
    assert.ok(clip, 'the frame carries the clip class');
    assert.equal(clip.style.overflow, '',
      'no inline overflow, or it would beat the stylesheet rule that sets ' +
      'overflow: clip and leave the frame scrollable');

    await click(ui.half('monkey half of a pair'));
    assert.ok(clip.contains(ui.dialog()), 'and it is the sheets that it clips');
  } finally { await ui.done(); }
});
