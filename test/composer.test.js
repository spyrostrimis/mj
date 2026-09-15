// The composer's Save gate, as a pure function. No DOM, no React renderer -
// Sheet.jsx only reads what these return.

import test from 'node:test';
import assert from 'node:assert/strict';

import { halfStatus, composerState, halfHint, newId } from '../src/data.js';

const complete = { text: 'made me tea', lang: 'acts' };
const empty = { text: '', lang: '' };
const noLang = { text: 'made me tea', lang: '' };
const noText = { text: '', lang: 'acts' };

test('halfStatus tells empty, partial and complete apart', () => {
  assert.equal(halfStatus(empty), 'empty');
  assert.equal(halfStatus(undefined), 'empty');
  assert.equal(halfStatus({ text: '   ', lang: '' }), 'empty');
  assert.equal(halfStatus(complete), 'complete');
  assert.equal(halfStatus(noLang), 'partial');
  assert.equal(halfStatus(noText), 'partial');
  assert.equal(halfStatus({ text: '   ', lang: 'acts' }), 'partial');
});

test('one complete half is enough to save', () => {
  assert.equal(composerState(complete, empty).canSave, true);
  assert.equal(composerState(empty, complete).canSave, true);
  assert.equal(composerState(complete, complete).canSave, true);
});

test('an untouched sheet cannot be saved', () => {
  const state = composerState(empty, empty);
  assert.equal(state.canSave, false);
  assert.deepEqual(state.incomplete, [], 'nothing to complain about yet');
});

test('a half-filled half blocks Save and is named', () => {
  const turtlePartial = composerState(complete, noLang);
  assert.equal(turtlePartial.canSave, false);
  assert.deepEqual(turtlePartial.incomplete, ['turtle']);

  const monkeyPartial = composerState(noText, complete);
  assert.equal(monkeyPartial.canSave, false);
  assert.deepEqual(monkeyPartial.incomplete, ['monkey']);

  const both = composerState(noLang, noText);
  assert.equal(both.canSave, false);
  assert.deepEqual(both.incomplete, ['monkey', 'turtle']);

  // Control: clearing the started half re-enables Save on the same fixture.
  assert.equal(composerState(complete, empty).canSave, true);
});

test('halfHint says what is missing', () => {
  assert.equal(halfHint(noLang), 'Pick a love language.');
  assert.equal(halfHint(noText), 'Add a few words.');
  assert.equal(halfHint(complete), '');
  assert.equal(halfHint(empty), '');
});

test('newId is unique and fits the id column', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newId('m-')));
  assert.equal(ids.size, 500, 'no collisions');
  for (const id of ids) {
    assert.ok(id.startsWith('m-'));
    assert.ok(id.length <= 64, 'must fit the server MAX_ID of 64');
  }
  assert.notEqual(newId(), newId());
});
