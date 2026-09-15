// Where a failed load sends the shell. Shell.jsx only reads what loadFailure
// returns, so the decision is testable without a DOM.
//
// The bug this covers: a 503 from the API middleware used to leave the shell
// unlocked, so a server with no APP_PASSWORD rendered as a normal journal
// with nothing in it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadFailure } from '../src/data.js';
import { ApiError } from '../src/api.js';
import { onRequest } from '../functions/api/_middleware.js';

test('401 is the ordinary locked state', () => {
  const { gate, message } = loadFailure(new ApiError(401, 'Unauthorized'));
  assert.equal(gate, 'locked');
  assert.equal(message, '', 'the lock screen speaks for itself');
});

test('a missing APP_PASSWORD is not an empty journal', () => {
  const err = new ApiError(503, 'Server is missing the APP_PASSWORD secret.');
  const { gate, message } = loadFailure(err);

  assert.equal(gate, 'unavailable');
  assert.notEqual(gate, 'open', 'the feed must never render on a 503');
  assert.equal(message, 'Server is missing the APP_PASSWORD secret.');

  // Positive control on the same run: a 401 still reaches the lock screen,
  // so 'unavailable' above is a decision and not a blanket answer.
  assert.equal(loadFailure(new ApiError(401, 'Unauthorized')).gate, 'locked');
});

test('the 503 it reacts to is the one the middleware really sends', async () => {
  const res = await onRequest({
    request: new Request('https://mj.test/api/entries'),
    env: {},                    // no APP_PASSWORD
    next: () => { throw new Error('the guarded route was reached'); },
  });
  assert.equal(res.status, 503);

  const body = await res.json();
  const { gate, message } = loadFailure(new ApiError(res.status, body.error));
  assert.equal(gate, 'unavailable');
  assert.equal(message, body.error);
});

test('a server error is unavailable too, with the server line', () => {
  const { gate, message } = loadFailure(new ApiError(500, 'Database error'));
  assert.equal(gate, 'unavailable');
  assert.equal(message, 'Database error');
});

test('a status-less failure gets a readable line, not browser noise', () => {
  const { gate, message } = loadFailure(new TypeError('Failed to fetch'));
  assert.equal(gate, 'unavailable');
  assert.doesNotMatch(message, /Failed to fetch/);
  assert.match(message, /Could not reach the journal/);

  // Control: an error that does carry a message still shows it.
  assert.equal(loadFailure(new ApiError(500, 'Database error')).message, 'Database error');
});

test('an unhelpful error still names its status', () => {
  assert.equal(loadFailure(new ApiError(502, '')).message, 'The journal could not be loaded (502).');
});
