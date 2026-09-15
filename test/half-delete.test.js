// Per-half delete as pure functions. Shell.jsx only reads what these return,
// so the list arithmetic is testable without a DOM or a React renderer.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeHalf, restoreHalf, deleteFailure, buildMoment,
} from '../src/data.js';
import { ApiError } from '../src/api.js';

const half = (id) => ({ id, text: 'TEST ' + id, lang: 'acts' });

const pair = () => ({
  id: 'p-1', pairId: 'p-1', date: '2026-01-02', time: '09:00',
  monkey: half('m-1'), turtle: half('t-1'),
});

const single = () => ({
  id: 'm-9', pairId: null, date: '2026-01-01', time: '08:00',
  monkey: half('m-9'), turtle: null,
});

test('the other half surviving keeps the moment, with that side null', () => {
  const list = removeHalf([pair(), single()], 'monkey', 'm-1');

  assert.equal(list.length, 2, 'the moment is kept, not dropped');
  assert.equal(list[0].id, 'p-1', 'and stays where it was');
  assert.equal(list[0].monkey, null);
  assert.deepEqual(list[0].turtle, half('t-1'), 'the surviving half is untouched');
  assert.equal(list[0].pairId, 'p-1', 'it is still the same pair');

  // Positive control: the moment beside it is not collateral damage.
  assert.deepEqual(list[1], single());
});

test('the last half takes the moment with it', () => {
  const list = removeHalf([pair(), single()], 'monkey', 'm-9');

  assert.equal(list.length, 1, 'the single is gone');
  assert.equal(list.find((e) => e.id === 'm-9'), undefined);

  // Positive control on the same fixture: the pair is still whole.
  assert.deepEqual(list[0], pair());
});

test('removeHalf does not mutate what it is given', () => {
  const list = [pair(), single()];
  const before = JSON.parse(JSON.stringify(list));

  const out = removeHalf(list, 'monkey', 'm-1');

  assert.deepEqual(list, before, 'the input list is unchanged');
  assert.notDeepEqual(out, before, 'and the output really did change');
});

test('a half is found by its row id, not by its moment id', () => {
  // 'x1' is a pair's pairId and, separately, an unrelated lone half's own id.
  // entries-db.test.js proves the server accepts exactly this. Moment ids do
  // not disambiguate it; row ids do.
  const overlapping = [
    { id: 'x1', pairId: 'x1', date: '2026-01-02', time: '09:00',
      monkey: half('m-2'), turtle: half('t-2') },
    { id: 'x1', pairId: null, date: '2026-01-01', time: '08:00',
      monkey: half('x1'), turtle: null },
  ];

  const list = removeHalf(overlapping, 'monkey', 'x1');

  assert.equal(list.length, 1, 'the lone half is gone');
  assert.deepEqual(list[0], overlapping[0], 'the pair sharing that id is whole');

  // Positive control: targeting the pair's own row id takes the pair's half
  // and leaves the single alone.
  const other = removeHalf(overlapping, 'monkey', 'm-2');
  assert.equal(other.length, 2);
  assert.equal(other[0].monkey, null);
  assert.deepEqual(other[1], overlapping[1]);
});

test('restoreHalf puts back the one half, in place', () => {
  const start = [pair(), single()];
  const removed = removeHalf(start, 'monkey', 'm-1');

  const back = restoreHalf(removed, 0, start[0], 'monkey');

  assert.deepEqual(back, start, 'the list round-trips');
  assert.equal(back.length, 2);
});

test('restoreHalf re-inserts a dropped moment at its index', () => {
  const start = [pair(), single()];
  const removed = removeHalf(start, 'monkey', 'm-9');
  assert.equal(removed.length, 1);

  const back = restoreHalf(removed, 1, start[1], 'monkey');

  assert.deepEqual(back, start, 'and lands where it was, not appended blindly');
});

test('a failed restore does not resurrect a half deleted in the meantime', () => {
  const start = [pair(), single()];
  const snapshot = start[0];            // both halves, as the tap saw it

  // Both halves are deleted back to back. The turtle request succeeds.
  let list = removeHalf(start, 'monkey', 'm-1');
  list = removeHalf(list, 'turtle', 't-1');
  assert.equal(list.length, 1, 'the moment is gone once both halves are');

  // Now the monkey request comes back failed. Only the monkey half may return:
  // the turtle half really was deleted, and a feed showing it would be a lie.
  const rolled = restoreHalf(list, 0, snapshot, 'monkey');

  assert.equal(rolled.length, 2);
  const moment = rolled.find((e) => e.id === 'p-1');
  assert.deepEqual(moment.monkey, half('m-1'), 'the failed half is back');
  assert.equal(moment.turtle, null, 'the half the server did delete stays deleted');

  // Positive control on the same snapshot: when the moment is still on screen,
  // the other side is what the list holds - which here is the turtle half,
  // present and untouched. So the null above is a decision, not a blanket.
  const stillThere = restoreHalf(removeHalf(start, 'monkey', 'm-1'), 0, snapshot, 'monkey');
  assert.deepEqual(stillThere.find((e) => e.id === 'p-1').turtle, half('t-1'));
});

test('a failed delete names the session, or asks for a retry', () => {
  assert.match(deleteFailure(new ApiError(401, 'Unauthorized')), /session expired/);
  assert.match(deleteFailure(new ApiError(500, 'Database error')), /could not be deleted/);
  assert.match(deleteFailure(new TypeError('Failed to fetch')), /could not be deleted/);

  // Control: the two outcomes really are different lines, so the fork is not
  // decorative.
  assert.notEqual(
    deleteFailure(new ApiError(401, 'x')),
    deleteFailure(new ApiError(500, 'x'))
  );
});

test('half ids and pair ids stay in separate namespaces', () => {
  // Deleting by a half's own row id is only unambiguous on the server because
  // a half id can never be some other moment's pair_id. buildMoment is the
  // only writer of ids, so its prefixes are what make that true.
  const m = buildMoment({ text: 'a', lang: 'acts' }, { text: 'b', lang: 'time' });
  assert.match(m.monkey.id, /^m-/);
  assert.match(m.turtle.id, /^t-/);
  assert.match(m.pairId, /^p-/);
});
