// Password gate. Shown when the API reports no valid session.
// Deliberately quiet - same cream paper, same serif, the two mascots and
// a single underlined field. Nothing here says "login form".

import { useState, useRef, useEffect } from 'react';
import { Monkey, Turtle } from './mascots.jsx';
import { login } from './api.js';

export function LockScreen({ accent, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(password);
      onUnlock();
    } catch (err) {
      setError(err.message || 'That password is not right.');
      setPassword('');
      inputRef.current?.focus();
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 26 }}>
        <Monkey size={44}/>
        <Turtle size={46}/>
      </div>

      <h1 style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 30, fontWeight: 400, letterSpacing: -0.5,
        margin: 0, color: '#1a1a1a', textAlign: 'center',
      }}>Monkey Journal</h1>

      <p style={{
        fontSize: 13.5, color: '#9a958d', marginTop: 8, marginBottom: 32,
        textAlign: 'center', lineHeight: 1.5,
      }}>A quiet place for the small things.</p>

      <form onSubmit={submit} style={{ width: '100%', maxWidth: 260 }}>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="Password"
          autoComplete="current-password"
          disabled={busy}
          style={{
            width: '100%',
            border: 'none',
            borderBottom: '1px solid ' + (error ? '#b85c3e' : 'rgba(26,26,26,0.16)'),
            outline: 'none', background: 'transparent',
            padding: '8px 2px',
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 18, fontStyle: 'italic', color: '#1a1a1a',
            letterSpacing: 0.4, textAlign: 'center',
            transition: 'border-color .15s ease',
          }}/>

        <div style={{
          height: 18, marginTop: 8,
          fontSize: 12, color: '#b85c3e', textAlign: 'center',
          opacity: error ? 1 : 0, transition: 'opacity .15s ease',
        }}>{error || ' '}</div>

        <button
          type="submit"
          disabled={!password || busy}
          style={{
            marginTop: 14, width: '100%', padding: '12px 16px',
            fontSize: 14.5, fontWeight: 500, letterSpacing: 0.2,
            border: 'none', borderRadius: 100,
            cursor: (password && !busy) ? 'pointer' : 'default',
            background: (password && !busy) ? accent : 'rgba(26,26,26,0.06)',
            color: (password && !busy) ? '#fafaf7' : '#9a958d',
            fontFamily: 'inherit',
            transition: 'background .15s ease',
          }}>
          {busy ? 'Opening…' : 'Open journal'}
        </button>
      </form>
    </div>
  );
}
