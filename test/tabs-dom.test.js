// Bottom-tab navigation, rendered for real in jsdom.
//
// The bug this covers: the calendar used to be a mode layered over the Today
// tab, so from the calendar the Today tab was already "active" and tapping it
// did nothing. The calendar is now a tab of its own, and every tab is
// reachable from every other one.
//
// jsdom does no layout, so nothing here asserts geometry - only which screen
// is mounted and what the tab bar contains.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { setupDom, stubFetch, render, click } from './helpers/dom.js';
import { App } from '../src/Shell.jsx';
import { TODAY_ISO } from '../src/data.js';

const FIXTURE = () => ([
  {
    id: 'm-test-1', pairId: null, date: TODAY_ISO, time: '09:15',
    monkey: { id: 'm-test-1', lang: 'gifts', text: 'TEST FAKE - lone monkey half' },
    turtle: null,
  },
]);

async function mount() {
  const dom = setupDom();
  const calls = stubFetch(FIXTURE());
  const view = await render(React.createElement(App));
  const { container } = view;

  const all = (sel) => [...container.querySelectorAll(sel)];
  const byLabel = (label) =>
    all('button').find((b) => b.getAttribute('aria-label') === label);

  // The tab bar is the only place a button carries both an icon and its own
  // text label, so match on the label text.
  const tabBar = () => container.querySelector('[data-tabs]');
  const tab = (label) =>
    [...tabBar().querySelectorAll('button')]
      .find((b) => b.textContent.trim() === label);

  return {
    container,
    tabBar,
    tab,
    tabLabels: () =>
      [...tabBar().querySelectorAll('button')].map((b) => b.textContent.trim()),
    // Which screen is mounted. The calendar has no page title; it is the only
    // screen with month arrows.
    screen: () => {
      if (byLabel('Previous month')) return 'calendar';
      const title = container.querySelector('h1.page-title');
      return title ? title.textContent.trim() : null;
    },
    calendarHeaderToday: () => {
      assert.ok(byLabel('Previous month'), 'not on the calendar screen');
      return byLabel('Today');
    },
    todayHeaderCalendar: () => byLabel('Calendar'),
    async done() {
      await view.unmount();
      dom.teardown();
      calls.restore();
    },
  };
}

test('the bottom bar offers Today, Calendar and Insights', async () => {
  const app = await mount();
  try {
    assert.deepEqual(app.tabLabels(), ['Today', 'Calendar', 'Insights']);
  } finally {
    await app.done();
  }
});

test('the Calendar tab opens the calendar', async () => {
  const app = await mount();
  try {
    assert.equal(app.screen(), 'Today');
    await click(app.tab('Calendar'));
    assert.equal(app.screen(), 'calendar');
  } finally {
    await app.done();
  }
});

test('the Today tab returns to Today from the calendar', async () => {
  const app = await mount();
  try {
    await click(app.tab('Calendar'));
    assert.equal(app.screen(), 'calendar', 'the calendar never opened');

    await click(app.tab('Today'));
    assert.equal(app.screen(), 'Today');
  } finally {
    await app.done();
  }
});

// Positive control for the test above: the same tap on the same tab bar has to
// keep working from the screen where it always worked.
test('the Today tab returns to Today from Insights', async () => {
  const app = await mount();
  try {
    await click(app.tab('Insights'));
    assert.equal(app.screen(), 'Love, broken down.', 'Insights never opened');

    await click(app.tab('Today'));
    assert.equal(app.screen(), 'Today');
  } finally {
    await app.done();
  }
});

test('the Insights tab is reachable from the calendar', async () => {
  const app = await mount();
  try {
    await click(app.tab('Calendar'));
    assert.equal(app.screen(), 'calendar', 'the calendar never opened');

    await click(app.tab('Insights'));
    assert.equal(app.screen(), 'Love, broken down.');
  } finally {
    await app.done();
  }
});

test("the calendar's own Today button returns to Today", async () => {
  const app = await mount();
  try {
    await click(app.todayHeaderCalendar());
    assert.equal(app.screen(), 'calendar', 'the calendar never opened');

    const back = app.calendarHeaderToday();
    assert.ok(back, 'the calendar header has no Today button');
    await click(back);
    assert.equal(app.screen(), 'Today');
  } finally {
    await app.done();
  }
});
