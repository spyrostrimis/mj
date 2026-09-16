// Shown when the journal could not be loaded at all - a server missing its
// APP_PASSWORD, a database error, no connection. Deliberately NOT the feed
// with a toast over it: an empty feed reads as "nothing written yet", which
// is a different and much quieter thing than "this is broken".
//
// Deliberately not the lock screen either. On a 503 the login endpoint
// returns the same 503, so a password field there could never succeed.

import { useState } from 'react';
import { Monkey, Turtle } from './mascots.jsx';

export function UnavailableScreen({ accent, message, onRetry }) {
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRetry();
    } finally {
      // If the retry worked the shell has already swapped this screen out.
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#fafaf7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 36px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 26, opacity: 0.4 }}>
        <Monkey size={44}/>
        <Turtle size={46}/>
      </div>

      <h1 style={{
        fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
        fontSize: 26, fontWeight: 400, letterSpacing: -0.4,
        margin: 0, color: '#1a1a1a', textAlign: 'center',
      }}>The journal is unavailable</h1>

      <p style={{
        fontSize: 13.5, color: '#9a958d', marginTop: 10, marginBottom: 0,
        textAlign: 'center', lineHeight: 1.55, maxWidth: 280,
      }}>{message}</p>

      <button
        onClick={retry}
        disabled={busy}
        style={{
          marginTop: 30, padding: '12px 28px',
          fontSize: 14.5, fontWeight: 500, letterSpacing: 0.2,
          border: 'none', borderRadius: 100,
          cursor: busy ? 'default' : 'pointer',
          background: busy ? 'rgba(26,26,26,0.06)' : accent,
          color: busy ? '#9a958d' : '#fafaf7',
          fontFamily: 'inherit',
          transition: 'background .15s ease',
        }}>
        {busy ? 'Trying…' : 'Try again'}
      </button>
    </div>
  );
}
