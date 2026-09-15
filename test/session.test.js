// Session helper tests. These cover behaviour that this feature does NOT change,
// which is the point: they prove the harness works before anything depends on it.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  passwordMatches,
  createSessionCookie,
  clearSessionCookie,
  hasValidSession,
} from '../functions/_session.js';

const PASSWORD = 'correct-horse-battery-staple';
const envWith = (password) => ({ APP_PASSWORD: password });

// The Set-Cookie header is "mj_session=<value>; Path=/; ..." - a Cookie request
// header is just the first pair.
const cookiePair = (setCookie) => setCookie.split(';')[0];

const requestWithCookie = (pair) =>
  new Request('https://example.test/api/entries', {
    headers: pair ? { Cookie: pair } : {},
  });

test('passwordMatches accepts the right password', async () => {
  assert.equal(await passwordMatches(PASSWORD, PASSWORD), true);
});

test('passwordMatches rejects a wrong password', async () => {
  assert.equal(await passwordMatches('not-the-password', PASSWORD), false);
  assert.equal(await passwordMatches(PASSWORD + 'x', PASSWORD), false);
  assert.equal(await passwordMatches('', PASSWORD), false);
});

test('passwordMatches rejects non-string input', async () => {
  assert.equal(await passwordMatches(undefined, PASSWORD), false);
  assert.equal(await passwordMatches(null, PASSWORD), false);
  assert.equal(await passwordMatches({}, PASSWORD), false);
});

test('passwordMatches rejects everything when no password is configured', async () => {
  assert.equal(await passwordMatches('', ''), false);
  assert.equal(await passwordMatches('anything', ''), false);
  assert.equal(await passwordMatches('anything', undefined), false);
});

test('createSessionCookie sets the hardening attributes', async () => {
  const cookie = await createSessionCookie(envWith(PASSWORD));
  assert.match(cookie, /^mj_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/);   // 30 days
});

test('a freshly issued cookie validates', async () => {
  const env = envWith(PASSWORD);
  const pair = cookiePair(await createSessionCookie(env));
  assert.equal(await hasValidSession(requestWithCookie(pair), env), true);
});

test('a tampered signature is rejected', async () => {
  const env = envWith(PASSWORD);
  const pair = cookiePair(await createSessionCookie(env));
  const [name, value] = pair.split('=');
  const [expires, sig] = value.split('.');

  // Flip one character of the signature, keeping the expiry intact.
  const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
  assert.notEqual(flipped, sig);

  assert.equal(
    await hasValidSession(requestWithCookie(`${name}=${expires}.${flipped}`), env),
    false
  );
  // Positive control: the untouched cookie still validates in this same test.
  assert.equal(await hasValidSession(requestWithCookie(pair), env), true);
});

test('an expired cookie is rejected', async (t) => {
  const env = envWith(PASSWORD);
  const pair = cookiePair(await createSessionCookie(env));
  assert.equal(await hasValidSession(requestWithCookie(pair), env), true);

  // Jump 31 days forward rather than forging an expiry, so the signature stays
  // genuine and expiry is the only thing under test.
  const realNow = Date.now();
  t.mock.method(Date, 'now', () => realNow + 31 * 24 * 60 * 60 * 1000);

  assert.equal(await hasValidSession(requestWithCookie(pair), env), false);
});

test('a cookie signed with a different password is rejected', async () => {
  const pair = cookiePair(await createSessionCookie(envWith(PASSWORD)));
  assert.equal(
    await hasValidSession(requestWithCookie(pair), envWith('a-different-password')),
    false
  );
});

test('a malformed or missing cookie is rejected', async () => {
  const env = envWith(PASSWORD);
  assert.equal(await hasValidSession(requestWithCookie(null), env), false);
  assert.equal(await hasValidSession(requestWithCookie('mj_session=garbage'), env), false);
  assert.equal(await hasValidSession(requestWithCookie('mj_session=.'), env), false);
  assert.equal(await hasValidSession(requestWithCookie('mj_session=abc.def'), env), false);
  assert.equal(await hasValidSession(requestWithCookie('other=value'), env), false);
});

test('no session is valid when APP_PASSWORD is unset', async () => {
  const pair = cookiePair(await createSessionCookie(envWith(PASSWORD)));
  assert.equal(await hasValidSession(requestWithCookie(pair), {}), false);
});

test('clearSessionCookie expires the cookie immediately', () => {
  const cookie = clearSessionCookie();
  assert.match(cookie, /^mj_session=;/);
  assert.match(cookie, /Max-Age=0/);
});
