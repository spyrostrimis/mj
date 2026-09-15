// Half actions - the bottom sheet a half opens.
//
// One action today, Delete. It is a list rather than a confirmation so Edit can
// become a second row later without re-teaching the gesture that opens it. The
// deliberate step is still two taps: open the sheet, then pick the action.

import { useState, useEffect, useRef } from 'react';
import { MonkeyTiny, TurtleTiny } from './mascots.jsx';
import { LangChip } from './Today.jsx';

const DANGER = '#a33a2b';   // brick, warm enough for the cream palette

function ActionRow({ label, note, color, innerRef, onClick }) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        border: 'none', borderRadius: 14, cursor: 'pointer',
        background: 'rgba(26,26,26,0.035)',
        fontFamily: 'inherit', transition: 'background .15s ease',
      }}>
      <span style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: 0.2, color }}>
        {label}
      </span>
      {note && (
        <span style={{ fontSize: 11.5, color: '#9a958d', letterSpacing: 0.2 }}>{note}</span>
      )}
    </button>
  );
}

export function HalfSheet({ target, accent, onCancel, onDelete }) {
  const open = !!target;

  // The sheet outlives its target by one transition so it can animate out.
  // Holding the last target in a ref keeps that frame painted without an extra
  // render, and re-rendering with the same value is harmless.
  const shown = useRef(null);
  if (target) shown.current = target;
  const t = target || shown.current;

  const [entered, setEntered] = useState(false);
  const cancelRef = useRef(null);
  const deleteRef = useRef(null);
  const fired     = useRef(false);
  const returnTo  = useRef(null);

  useEffect(() => {
    if (!open) { setEntered(false); return; }
    fired.current = false;
    returnTo.current = document.activeElement;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Cancel takes focus, never Delete. A destructive action does not get to be
  // the thing a stray Enter reaches.
  useEffect(() => { if (entered) cancelRef.current?.focus(); }, [entered]);

  const close = () => {
    const el = returnTo.current;
    onCancel();
    if (el && document.contains(el)) el.focus();
  };

  // Delete fires once. A double-tap lands inside the same frame, before the
  // sheet has gone, so the latch is what stops a second DELETE.
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    onDelete();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      // Two stops only, so the cycle is written out rather than computed.
      const first = cancelRef.current;
      const last  = deleteRef.current;
      if (!first || !last) return;
      e.preventDefault();
      const active = document.activeElement;
      (e.shiftKey
        ? (active === first ? last : first)
        : (active === last ? first : last)
      ).focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!t) return null;

  const Mascot = t.who === 'monkey' ? MonkeyTiny : TurtleTiny;
  const label  = t.who === 'monkey' ? 'Monkey' : 'I';
  const title  = t.who === 'monkey' ? "Monkey's half" : 'My half';
  const note   = t.lastHalf
    ? 'The only half left - the moment goes too.'
    : "This can't be undone.";

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(20,18,14,0.32)',
          opacity: entered ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 40,
        }}/>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="half-sheet-title"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: '88%',
          background: '#fafaf7',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -12px 32px -10px rgba(0,0,0,0.18), 0 -1px 0 rgba(26,26,26,0.06)',
          transform: 'translateY(' + (entered ? '0' : '100%') + ')',
          transition: 'transform .28s cubic-bezier(.2,.7,.2,1)',
          zIndex: 41,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 38, height: 4, borderRadius: 4, background: 'rgba(26,26,26,0.18)' }}/>
        </div>

        <div
          id="half-sheet-title"
          style={{
            padding: '4px 20px 14px', textAlign: 'center',
            fontSize: 11, color: '#9a958d', letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 500,
          }}>{title}</div>

        <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '0 20px' }}/>

        <div style={{
          flex: 1, overflow: 'auto',
          padding: '18px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          {/* The half itself, so the action is taken against something seen
              and not against a remembered tap. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mascot size={14} color="#5a554c"/>
              <span style={{ fontSize: 11.5, color: '#5a554c', letterSpacing: 0.3, fontWeight: 500 }}>{label}</span>
              <span style={{ width: 3, height: 3, borderRadius: 3, background: '#cfc9bf', margin: '0 2px' }}/>
              <LangChip langKey={t.half.lang} accent={accent}/>
            </div>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 17, lineHeight: 1.45, color: '#1a1a1a',
              fontStyle: 'italic', letterSpacing: 0.1,
            }}>{t.half.text}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionRow
              innerRef={deleteRef}
              label="Delete" note={note} color={DANGER}
              onClick={fire}/>
            <ActionRow
              innerRef={cancelRef}
              label="Cancel" color="#5a554c"
              onClick={close}/>
          </div>
        </div>
      </div>
    </>
  );
}
