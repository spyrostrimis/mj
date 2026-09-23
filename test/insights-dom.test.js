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
