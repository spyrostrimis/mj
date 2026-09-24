// The Insights screen, rendered for real in jsdom.
//
// Only DOM text is asserted here - which lines appear on which tab - never
// geometry, which jsdom does not compute.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { setupDom, render, click } from './helpers/dom.js';
import { InsightsScreen } from '../src/Insights.jsx';
import { TODAY_ISO } from '../src/data.js';

const ACCENT = '#b5553a';

const pair = (id, mLang, tLang, date = TODAY_ISO) => ({
  id, pairId: id, date, time: '09:00',
  monkey: { id: id + 'm', text: 'TEST FAKE - monkey ' + id, lang: mLang },
  turtle: { id: id + 't', text: 'TEST FAKE - turtle ' + id, lang: tLang },
});
const monkeyOnly = (id, lang, date = TODAY_ISO) => ({
  id, pairId: null, date, time: '09:00',
  monkey: { id, text: 'TEST FAKE - monkey ' + id, lang }, turtle: null,
});
const turtleOnly = (id, lang, date = TODAY_ISO) => ({
  id, pairId: null, date, time: '09:00',
  monkey: null, turtle: { id, text: 'TEST FAKE - turtle ' + id, lang },
});

async function mountInsights(entries) {
  const dom = setupDom();
  const view = await render(
    React.createElement(InsightsScreen, { entries, accent: ACCENT })
  );
  const { container } = view;
  const button = (label) =>
    [...container.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === label);
  const text = (sel) => container.querySelector(sel)?.textContent.trim() ?? null;

  return {
    container,
    text,
    pattern: () => text('[data-pattern]'),
    async tab(label) {
      const b = button(label);
      assert.ok(b, 'no button labelled ' + label);
      await click(b);
    },
    async click(label) { await this.tab(label); },
    button,
    async done() {
      await view.unmount();
      dom.teardown();
    },
  };
}

const BOTH_SIDES = () => [
  pair('p1', 'time', 'acts'),
  monkeyOnly('m1', 'time'),
];

test('Both reads the two sides together', async () => {
  const app = await mountInsights(BOTH_SIDES());
  try {
    const p = app.pattern();
    assert.match(p, /Monkey leans into Time\./);
    assert.match(p, /You return it in Acts\./);
  } finally {
    await app.done();
  }
});

test('Him speaks only for Monkey', async () => {
  const app = await mountInsights(BOTH_SIDES());
  try {
    await app.tab('Him');
    const p = app.pattern();
    assert.match(p, /Monkey leans into Time\./, 'positive control');
    assert.doesNotMatch(p, /You /);
  } finally {
    await app.done();
  }
});

test('Me speaks only for Turtle, in its own words', async () => {
  const app = await mountInsights(BOTH_SIDES());
  try {
    await app.tab('Me');
    const p = app.pattern();
    assert.match(p, /You lean into Acts\./, 'positive control');
    assert.doesNotMatch(p, /Monkey/);
    assert.doesNotMatch(p, /return it/);
  } finally {
    await app.done();
  }
});

test('a tab with nothing logged on its side shows no Pattern', async () => {
  const app = await mountInsights([monkeyOnly('m1', 'gifts')]);
  try {
    await app.tab('Him');
    assert.match(app.pattern(), /Monkey leans into Gifts\./, 'positive control');
    await app.tab('Me');
    assert.equal(app.pattern(), null, 'Turtle has logged nothing');
  } finally {
    await app.done();
  }
});

test('a tie is named as a split, not settled by list order', async () => {
  const app = await mountInsights([
    pair('p1', 'touch', 'acts'),
    pair('p2', 'time', 'time'),
    turtleOnly('t1', 'acts'),
  ]);
  try {
    // Monkey: touch 1, time 1. Turtle: acts 2, time 1.
    assert.match(app.pattern(), /Monkey splits between Touch and Time\./);
    assert.match(app.pattern(), /You return it in Acts\./, 'no tie, no split');
    await app.tab('Him');
    assert.match(app.pattern(), /Monkey splits between Touch and Time\./);
    await app.tab('Me');
    assert.match(app.pattern(), /You lean into Acts\./, 'positive control');
  } finally {
    await app.done();
  }
});

test('Me names its own tie as a split', async () => {
  const app = await mountInsights([turtleOnly('t1', 'gifts'), turtleOnly('t2', 'words')]);
  try {
    await app.tab('Me');
    assert.match(app.pattern(), /You split between Words and Gifts\./);
  } finally {
    await app.done();
  }
});

test('there is no moment count on the page', async () => {
  const app = await mountInsights(BOTH_SIDES());
  try {
    assert.ok(app.pattern(), 'positive control: the page rendered');
    assert.doesNotMatch(app.container.textContent, /moments? (logged|this)/);
  } finally {
    await app.done();
  }
});

test('the period row sits under Him / Me / Both, and the title above both', async () => {
  const app = await mountInsights(BOTH_SIDES());
  try {
    const FOLLOWING = 4;   // Node.DOCUMENT_POSITION_FOLLOWING
    const after = (a, b) => !!(a.compareDocumentPosition(b) & FOLLOWING);
    const title = app.container.querySelector('h1.page-title');
    assert.ok(after(title, app.button('Him')), 'the title comes first');
    assert.ok(after(app.button('Both'), app.button('This week')), 'the period row follows Both');
    assert.ok(!after(app.button('This week'), app.button('Both')), 'positive control: the order is not symmetric');
  } finally {
    await app.done();
  }
});

test('the period narrows the bars and the Pattern', async () => {
  const app = await mountInsights([
    pair('p1', 'time', 'acts'),
    monkeyOnly('old1', 'gifts', '2000-01-01'),
    monkeyOnly('old2', 'gifts', '2000-01-02'),
  ]);
  try {
    assert.match(app.pattern(), /Monkey leans into Gifts\./, 'positive control');
    assert.match(app.container.textContent, /Gifts67%/, 'positive control: 2 of 3 halves');

    await app.tab('This week');
    assert.match(app.pattern(), /Monkey leans into Time\./);
    assert.match(app.container.textContent, /Gifts0%/, 'the old Gifts halves are gone');
    assert.equal(app.button('This week').getAttribute('aria-pressed'), 'true');
    assert.equal(app.button('All time').getAttribute('aria-pressed'), 'false');
  } finally {
    await app.done();
  }
});

test('an empty period says so and claims no Pattern', async () => {
  const app = await mountInsights([monkeyOnly('old1', 'gifts', '2000-01-01')]);
  try {
    assert.ok(app.pattern(), 'positive control: all time has a Pattern');
    await app.tab('This year');
    assert.match(app.container.textContent, /Nothing logged this year yet\./);
    assert.equal(app.pattern(), null);
  } finally {
    await app.done();
  }
});

test('the quiet line speaks for the tab it is on, whatever the period', async () => {
  // Today: Monkey has used everything but Gifts; Turtle only Acts and Time.
  const entries = [
    pair('p1', 'words', 'acts'), pair('p2', 'acts', 'time'),
    pair('p3', 'touch', 'acts'), monkeyOnly('m1', 'time'),
  ];
  const app = await mountInsights(entries);
  try {
    const quiet = () => app.text('[data-quiet]');
    assert.equal(quiet(), 'Gifts has been quiet lately.');
    await app.tab('Him');
    assert.equal(quiet(), 'Gifts has been quiet from him lately.');
    await app.tab('Me');
    assert.equal(quiet(), null, 'three unused is too many to name');
    assert.match(app.pattern(), /You lean into Acts\./, 'positive control');
    await app.tab('Him');
    await app.tab('This year');
    assert.equal(quiet(), 'Gifts has been quiet from him lately.', 'the period does not move it');
  } finally {
    await app.done();
  }
});

test('the translation table is on Both only, and follows the period', async () => {
  const app = await mountInsights([
    pair('p1', 'words', 'time'),
    pair('old', 'touch', 'acts', '2000-01-01'),
    monkeyOnly('m1', 'gifts'),
  ]);
  try {
    const table = () => app.text('[data-translation]');
    assert.match(table(), /When he gives Words,\s*you answer with Time\.\s*1×/);
    assert.match(table(), /When he gives Touch,\s*you answer with Acts\./);
    assert.doesNotMatch(table(), /Gifts/, 'a lone half answers nothing');

    await app.tab('This year');
    assert.match(table(), /Words/, 'positive control');
    assert.doesNotMatch(table(), /Touch/, 'the old pair is outside this year');

    await app.tab('Him');
    assert.equal(table(), null);
    await app.tab('Me');
    assert.equal(table(), null);
  } finally {
    await app.done();
  }
});

test('Remember when shows one past moment, and Another always changes it', async () => {
  const app = await mountInsights([
    pair('p1', 'words', 'acts', '2000-01-01'),
    monkeyOnly('m1', 'time', '2000-01-02'),
    turtleOnly('t1', 'gifts', '2000-01-03'),
  ]);
  try {
    const memory = () => app.text('[data-memory]');
    assert.match(memory(), /TEST FAKE/, 'a memory is on screen');

    let before = memory();
    for (let i = 0; i < 6; i++) {
      await app.click('Another');
      assert.notEqual(memory(), before, 'Another repeated the moment on screen');
      before = memory();
    }

    await app.tab('This week');
    assert.match(memory(), /TEST FAKE/, 'memories are not bounded by the period');
  } finally {
    await app.done();
  }
});

test('Him remembers only his halves, Me only mine', async () => {
  const app = await mountInsights([pair('p1', 'words', 'acts', '2000-01-01')]);
  try {
    await app.tab('Him');
    assert.match(app.text('[data-memory]'), /TEST FAKE - monkey p1/);
    assert.doesNotMatch(app.text('[data-memory]'), /turtle p1/);
    await app.tab('Me');
    assert.match(app.text('[data-memory]'), /TEST FAKE - turtle p1/);
    assert.doesNotMatch(app.text('[data-memory]'), /monkey p1/);
    assert.equal(app.button('Another'), undefined, 'one memory, nothing to swap to');
  } finally {
    await app.done();
  }
});
