// Shared session helpers.
// Files under functions/ prefixed with "_" are treated as modules, not routes.
//
// A session is a signed, expiring cookie. The HMAC key is APP_PASSWORD itself,
// so changing the password automatically invalidates every existing session.

const ENC = new TextEncoder();
const COOKIE_NAME = 'mj_session';
const SESSION_DAYS = 30;

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(message));
  return b64url(new Uint8Array(sig));
}

// Compare by digest so the comparison time never depends on how many
// leading characters happen to match.
export async function passwordMatches(submitted, expected) {
  if (typeof submitted !== 'string' || typeof expected !== 'string') return false;
  if (!expected) return false;
  const [a, b] = await Promise.all([
    hmac('mj-compare', submitted),
    hmac('mj-compare', expected),
  ]);
  return a === b;
}

export async function createSessionCookie(env) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmac(env.APP_PASSWORD, String(expires));
  const value = `${expires}.${sig}`;
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function hasValidSession(request, env) {
  if (!env.APP_PASSWORD) return false;

  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const [expires, sig] = match[1].split('.');
  if (!expires || !sig) return false;
  if (!Number(expires) || Number(expires) < Date.now()) return false;

  const expected = await hmac(env.APP_PASSWORD, expires);
  return sig === expected;
}
