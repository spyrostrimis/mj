// API client. Every call goes through the session-cookie guard on the server.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep the default message */ }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export const checkSession = () =>
  request('/api/auth');

export const login = (password) =>
  request('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

export const logout = () =>
  request('/api/auth', { method: 'DELETE' });

export const loadEntries = () =>
  request('/api/entries');

export const saveEntry = (entry) =>
  request('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });

export const deleteEntry = (id) =>
  request(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
