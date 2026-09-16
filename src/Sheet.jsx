// Quick Sheet - the bottom-up composer.
// Two text areas, two chip pickers, one Save. Either half alone is a valid
// moment; Save is blocked only while a half the writer started is unfinished.

import { useState, useRef, useEffect } from 'react';
import { MonkeyTiny, TurtleTiny } from './mascots.jsx';
import { CheckIcon } from './icons.jsx';
import { LANGS, composerState, halfHint, buildMoment } from './data.js';

const HINT = '#b07d4a';   // warm, muted - a nudge, not an error

function GrowTextarea({ value, onChange, placeholder, autoFocus }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      rows={1}
      style={{
        width: '100%', border: 'none', outline: 'none', resize: 'none',
        background: 'transparent', padding: 0, margin: 0,
        fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
        fontSize: 17, lineHeight: 1.45, color: '#1a1a1a',
        fontStyle: 'italic', letterSpacing: 0.1,
        minHeight: 24, overflow: 'auto',
        WebkitAppearance: 'none',
      }}/>
  );
}

function ChipPicker({ value, onChange, accent }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {LANGS.map(l => {
        const active = value === l.key;
        return (
          <button
            key={l.key}
            type="button"
            onClick={() => onChange(l.key)}
            style={{
              padding: '5px 11px',
              fontSize: 12, fontWeight: 500, letterSpacing: 0.2,
              border: active ? '1px solid ' + accent : '1px solid rgba(26,26,26,0.14)',
              color: active ? accent : '#5a554c',
              background: active ? accent + '0d' : 'transparent',
              borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .12s ease',
            }}>{l.label}</button>
        );
      })}
    </div>
  );
}

function HalfComposer({ who, value, onChange, accent, autoFocus, unfinished }) {
  const Mascot = who === 'monkey' ? MonkeyTiny : TurtleTiny;
  const label  = who === 'monkey' ? 'Monkey' : 'I';
  const prompt = who === 'monkey'
    ? 'A small thing he did…'
    : 'A small thing I did for him…';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Mascot size={14} color="#5a554c"/>
        <span style={{
          fontSize: 11.5, color: unfinished ? HINT : '#5a554c', letterSpacing: 0.4,
          textTransform: 'uppercase', fontWeight: 500,
        }}>{label}</span>
      </div>
      <GrowTextarea
        value={value.text}
        onChange={(t) => onChange({ ...value, text: t })}
        placeholder={prompt}
        autoFocus={autoFocus}/>
      <ChipPicker
        value={value.lang}
        onChange={(k) => onChange({ ...value, lang: k })}
        accent={accent}/>
      {unfinished && (
        <div style={{ fontSize: 11.5, color: HINT, letterSpacing: 0.2 }}>
          {halfHint(value)}
        </div>
      )}
    </div>
  );
}

export function QuickSheet({ open, onClose, onSave, accent }) {
  const [monkey, setMonkey] = useState({ text: '', lang: '' });
  const [turtle, setTurtle] = useState({ text: '', lang: '' });

  // `entered` drives the transform. Flipping it a double-rAF after `open`
  // gives the browser a painted frame at translateY(100%) to animate from.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    );
    setMonkey({ text: '', lang: '' });
    setTurtle({ text: '', lang: '' });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const state = composerState(monkey, turtle);
  const canSave = state.canSave;

  const handleSave = () => {
    const moment = buildMoment(monkey, turtle);
    if (!moment) return;
    onSave(moment);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(20,18,14,0.32)',
          opacity: entered ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 40,
        }}/>

      <div style={{
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

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 20px 14px',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 14, color: '#5a554c', padding: '6px 0', fontFamily: 'inherit',
            }}>Cancel</button>
          <div style={{
            fontSize: 11, color: '#9a958d', letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 500,
          }}>New moment</div>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: 'transparent', border: 'none',
              cursor: canSave ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 600,
              color: canSave ? accent : '#cfc9bf',
              padding: '6px 0', fontFamily: 'inherit',
              transition: 'color .15s ease',
            }}>Save</button>
        </div>

        <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '0 20px' }}/>

        <div style={{
          flex: 1, overflow: 'auto',
          padding: '18px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <HalfComposer
            who="monkey" value={monkey} onChange={setMonkey} accent={accent}
            autoFocus={open} unfinished={state.monkey === 'partial'}/>
          <div style={{ height: 1, background: 'rgba(26,26,26,0.06)' }}/>
          <HalfComposer
            who="turtle" value={turtle} onChange={setTurtle} accent={accent}
            unfinished={state.turtle === 'partial'}/>

          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              marginTop: 6, width: '100%', padding: '13px 16px',
              fontSize: 14.5, fontWeight: 500, letterSpacing: 0.2,
              border: 'none', cursor: canSave ? 'pointer' : 'default',
              borderRadius: 100,
              background: canSave ? accent : 'rgba(26,26,26,0.06)',
              color: canSave ? '#fafaf7' : '#9a958d',
              fontFamily: 'inherit', transition: 'background .15s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {canSave && <CheckIcon size={14} color="#fafaf7"/>}
            Save moment
          </button>
        </div>
      </div>
    </>
  );
}
