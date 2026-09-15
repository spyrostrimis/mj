// The delete wrapper's half of the server contract.
//
// The bug this covers: the endpoint gained a required ?kind= while the feed's
// only caller still passed one argument. Nothing failed at test time - the
// wrapper happily sent ?kind=undefined and the server's 400 surfaced as
// "That could not be deleted", so a wiring mistake read as a server fault.

import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteEntry } from '../src/api.js';

// Records what the wrapper puts on the wire, without a network.
function captureFetch(fn) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    calls.push({ url, method: options?.method, credentials: options?.credentials });
    return Promise.resolve(
      new Response('{"ok":true,"deleted":1}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  };
  return fn(calls).finally(() => { globalThis.fetch = original; });
}

test('deleteEntry refuses to guess which id space it was handed', () => {
  assert.throws(() => deleteEntry('m-1'), /kind must be/, 'no kind at all');
  assert.throws(() => deleteEntry('m-1', undefined), /kind must be/);
  assert.throws(() => deleteEntry('m-1', 'moment'), /kind must be/, 'not a real kind');
  assert.throws(() => deleteEntry('m-1', ''), /kind must be/);

  // The specific shape that shipped broken: the old one-argument call must
  // never reach the network, because ?kind=undefined is a 400 wearing a
  // server error's clothes.
  assert.throws(() => deleteEntry('m-1'), /got undefined/);
});

test('deleteEntry names the id space in the URL', () => captureFetch(async (calls) => {
  await deleteEntry('m-1', 'half');
  await deleteEntry('p-1', 'pair');

  // Positive control for the refusals above: valid kinds do reach the wire,
  // so the throws are a decision about bad input and not a dead function.
  assert.deepEqual(calls.map((c) => c.url), [
    '/api/entries/m-1?kind=half',
    '/api/entries/p-1?kind=pair',
  ]);
  assert.deepEqual(calls.map((c) => c.method), ['DELETE', 'DELETE']);
  assert.deepEqual(calls.map((c) => c.credentials), ['same-origin', 'same-origin']);
}));

test('deleteEntry escapes the id it is given', () => captureFetch(async (calls) => {
  await deleteEntry('a/b?kind=pair', 'half');
  assert.equal(calls[0].url, '/api/entries/a%2Fb%3Fkind%3Dpair?kind=half',
    'an id cannot smuggle in a second kind');
}));
