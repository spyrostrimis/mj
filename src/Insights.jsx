// Insights - hairline bars per love language, across all time.
// Segmented control switches between Him / Me / Both.

import { useState } from 'react';
import { ScreenShell, ScreenScroll } from './layout.jsx';
import { MonkeyTiny, TurtleTiny } from './mascots.jsx';
import { LANGS, LANG_BY_KEY, computeStats, topLang } from './data.js';

function Segmented({ value, onChange, options, accent }) {
  return (
    <div style={{
      display: 'flex', padding: 3, borderRadius: 100,
      background: 'rgba(26,26,26,0.04)',
      border: '1px solid rgba(26,26,26,0.06)',
    }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '7px 12px',
              fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2,
              border: 'none', cursor: 'pointer', borderRadius: 100,
              background: active ? '#fafaf7' : 'transparent',
              color: active ? accent : '#5a554c',
              boxShadow: active
                ? '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(26,26,26,0.04)'
                : 'none',
              transition: 'all .15s ease',
              fontFamily: 'inherit',
            }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

function BarRow({ label, value, total, accent }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 8 }}>
        <span style={{ color: '#1a1a1a' }}>{label}</span>
        <span style={{ color: '#9a958d', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(26,26,26,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: pct + '%', background: accent,
          transition: 'width .5s cubic-bezier(.2,.7,.2,1)',
        }}/>
      </div>
    </div>
  );
}

function PairedBarRow({ label, monkeyN, turtleN, monkeyTotal, turtleTotal, accent }) {
  const mPct = monkeyTotal > 0 ? Math.round((monkeyN / monkeyTotal) * 100) : 0;
  const tPct = turtleTotal > 0 ? Math.round((turtleN / turtleTotal) * 100) : 0;
  const track = { flex: 1, height: 3, background: 'rgba(26,26,26,0.06)', borderRadius: 2, overflow: 'hidden' };
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 13.5, marginBottom: 10,
      }}>
        <span style={{ color: '#1a1a1a' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#9a958d', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: accent }}>{mPct}%</span>
          <span style={{ margin: '0 6px', opacity: 0.4 }}>{'·'}</span>
          <span>{tPct}%</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MonkeyTiny size={11} color="#9a958d"/>
          <div style={track}>
            <div style={{ height: '100%', width: mPct + '%', background: accent, transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }}/>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TurtleTiny size={11} color="#9a958d"/>
          <div style={track}>
            <div style={{ height: '100%', width: tPct + '%', background: accent + '88', transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InsightsScreen({ entries, accent }) {
  const [view, setView] = useState('both');
  const stats = computeStats(entries);
  const total = stats.momentCount;
  const halves = stats.monkeyTotal + stats.turtleTotal;
  const mTop  = topLang(stats.monkey);
  const tTop  = topLang(stats.turtle);

  // Him and Me each speak for one side only; Both reads the two together.
  const showM = view !== 'me'  && mTop;
  const showT = view !== 'him' && tTop;

  const sorted = [...LANGS].sort((a, b) => {
    if (view === 'him') return stats.monkey[b.key] - stats.monkey[a.key];
    if (view === 'me')  return stats.turtle[b.key] - stats.turtle[a.key];
    return (stats.monkey[b.key] + stats.turtle[b.key])
         - (stats.monkey[a.key] + stats.turtle[a.key]);
  });

  return (
    <ScreenShell>
      <div style={{ padding: '18px 24px 16px' }}>
        <div className="eyebrow">All time</div>
        <h1 className="page-title" style={{ marginTop: 6 }}>Love, broken down.</h1>
        <div style={{ fontSize: 13.5, color: '#9a958d', marginTop: 6 }}>
          {total} {total === 1 ? 'moment' : 'moments'} logged.
        </div>
      </div>

      <div style={{ padding: '0 24px 6px' }}>
        <Segmented
          value={view} onChange={setView} accent={accent}
          options={[
            { value: 'him',  label: 'Him' },
            { value: 'me',   label: 'Me' },
            { value: 'both', label: 'Both' },
          ]}/>
      </div>

      <ScreenScroll>
        <div style={{ padding: '20px 24px 110px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {halves === 0 ? (
            <div style={{
              paddingTop: 16,
              fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
              fontSize: 17, color: '#b8b3aa', fontStyle: 'italic', lineHeight: 1.4,
            }}>No moments logged yet.<br/>Start with Today.</div>
          ) : (
            sorted.map(l => {
              if (view === 'him') {
                return <BarRow key={l.key} label={l.label} value={stats.monkey[l.key]} total={stats.monkeyTotal} accent={accent}/>;
              }
              if (view === 'me') {
                return <BarRow key={l.key} label={l.label} value={stats.turtle[l.key]} total={stats.turtleTotal} accent={accent}/>;
              }
              return (
                <PairedBarRow
                  key={l.key} label={l.label}
                  monkeyN={stats.monkey[l.key]} turtleN={stats.turtle[l.key]}
                  monkeyTotal={stats.monkeyTotal} turtleTotal={stats.turtleTotal}
                  accent={accent}/>
              );
            })
          )}

          {(showM || showT) && (
            <div data-pattern style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid rgba(26,26,26,0.08)' }}>
              <div className="eyebrow">Pattern</div>
              <div style={{
                fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
                fontSize: 22, lineHeight: 1.25, letterSpacing: -0.3,
                color: '#1a1a1a', marginTop: 8,
              }}>
                {/* Each line only appears once that side has something logged,
                    so the journal never claims a lean it has not seen. */}
                {showM && (
                  <>Monkey leans into <span style={{ color: accent }}>{LANG_BY_KEY[mTop].label}</span>.</>
                )}
                {showM && showT && <br/>}
                {showT && (
                  <>{view === 'me' ? 'You lean into' : 'You return it in'} <span style={{ color: accent }}>{LANG_BY_KEY[tTop].label}</span>.</>
                )}
              </div>
            </div>
          )}

          {view === 'both' && halves > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              fontSize: 11.5, color: '#9a958d', marginTop: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MonkeyTiny size={12} color="#9a958d"/> from him
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TurtleTiny size={12} color="#9a958d"/> from me
              </div>
            </div>
          )}
        </div>
      </ScreenScroll>
    </ScreenShell>
  );
}
