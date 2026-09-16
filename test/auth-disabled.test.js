// The AUTH_DISABLED escape hatch on the /api/* guard.
//
// This flag opens the journal to anyone with the URL, so the thing worth
// testing is not that it works - it is that it fails CLOSED. Every value
// other than the exact string '1' must leave the password on.
//
// context.next() is a spy that returns a recognisable 200. Seeing that 200
// is the only proof the request got past the guard; a 401 is the control.

import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/_middleware.js';

const PASSED_THROUGH = 'passed through the guard';

// A session cookie is never sent, so anything that reaches hasValidSession
// is unauthorised. APP_PASSWORD is present throughout: without it the guard
// answers 503 before it ever reaches the session check, and a 503 would hide
// whether the gate was open or shut.
function call(env, path = '/api/entries') {
  let nextCalls = 0;
  const res = onRequest({
    request: new Request('https://mj.test' + path),
    env: { APP_PASSWORD: 'pw', ...env },
    next: () => {
      nextCalls += 1;
      return new Response(PASSED_THROUGH, { status: 200 });
    },
  });
  return res.then(r => ({ res: r, nextCalls: () => nextCalls }));
}

async function isOpen(env) {
  const { res, nextCalls } = await call(env);
  assert.equal(res.status, 200, `expected the guard to open, got ${res.status}`);
  assert.equal(await res.text(), PASSED_THROUGH);
  assert.equal(nextCalls(), 1, 'context.next() should have been called exactly once');
}

async function isShut(env) {
  const { res, nextCalls } = await call(env);
  assert.equal(res.status, 401, `expected the guard to hold, got ${res.status}`);
  assert.deepEqual(await res.json(), { error: 'Unauthorized' });
  assert.equal(nextCalls(), 0, 'context.next() must not be called for a blocked request');
}

test("AUTH_DISABLED='1' lets an unauthenticated request through", async () => {
  await isOpen({ AUTH_DISABLED: '1' });
});

// The positive control for every assertion above: same fixture, same run,
// same unauthenticated request - only the flag differs.
test('without the flag the same request is still refused', async () => {
  await isShut({});
});

test('the flag fails closed on anything that is not exactly "1"', async () => {
  for (const value of ['0', '', 'true', 'yes', 'on', ' 1', '1 ', 'TRUE', 'disabled']) {
    await isShut({ AUTH_DISABLED: value });
  }
});

test('a non-string that merely looks truthy does not open the gate', async () => {
  for (const value of [1, true, {}, []]) {
    await isShut({ AUTH_DISABLED: value });
  }
});

test('/api/auth stays public either way, so login still works when the gate returns', async () => {
  for (const env of [{}, { AUTH_DISABLED: '1' }]) {
    const { res } = await call(env, '/api/auth');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), PASSED_THROUGH);
  }
});

// The flag short-circuits before the APP_PASSWORD check, so an open journal
// does not also need the secret to be present. Without the flag, a missing
// secret is still the 503 the shell turns into "unavailable" - not a 401,
// and not an open door.
test('a missing APP_PASSWORD is an open journal only when the flag is set', async () => {
  const open = await call({ APP_PASSWORD: undefined, AUTH_DISABLED: '1' });
  assert.equal(open.res.status, 200);

  const shut = await call({ APP_PASSWORD: undefined });
  assert.equal(shut.res.status, 503);
  assert.equal(shut.nextCalls(), 0);
});
