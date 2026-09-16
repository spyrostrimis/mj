// Guards every /api/* route except the login endpoint itself.
// Static assets are not affected - the app shell loads freely and only
// the journal data behind the API requires a session.

import { hasValidSession } from '../_session.js';

const PUBLIC_PATHS = new Set(['/api/auth']);

export async function onRequest(context) {
  const { request, env } = context;
  const { pathname } = new URL(request.url);

  if (PUBLIC_PATHS.has(pathname)) return context.next();

  // TEMPORARY, while the app is still being built: AUTH_DISABLED opens the
  // journal to anyone who has the URL. The comparison is against the exact
  // string '1' so the gate fails closed - an unset, empty, misspelled or
  // truthy-looking value ('0', 'true', 'yes') all leave the password on.
  // Set in wrangler.toml; deleting that [vars] block restores the lock.
  if (env.AUTH_DISABLED === '1') return context.next();

  if (!env.APP_PASSWORD) {
    return Response.json(
      { error: 'Server is missing the APP_PASSWORD secret.' },
      { status: 503 }
    );
  }

  if (!(await hasValidSession(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return context.next();
}
