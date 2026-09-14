// POST   /api/auth  - exchange the shared password for a session cookie
// GET    /api/auth  - report whether the caller already has a valid session
// DELETE /api/auth  - log out

import {
  passwordMatches,
  createSessionCookie,
  clearSessionCookie,
  hasValidSession,
} from '../_session.js';

export async function onRequestGet({ request, env }) {
  const ok = await hasValidSession(request, env);
  return Response.json({ authenticated: ok });
}

export async function onRequestPost({ request, env }) {
  if (!env.APP_PASSWORD) {
    return Response.json(
      { error: 'Server is missing the APP_PASSWORD secret.' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await passwordMatches(body?.password, env.APP_PASSWORD))) {
    return Response.json({ error: 'That password is not right.' }, { status: 401 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': await createSessionCookie(env),
    },
  });
}

export function onRequestDelete() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
