// Insights - hairline bars per love language over a chosen period.
// Segmented control switches between Him / Me / Both.

import { useState } from 'react';
import { ScreenShell, ScreenScroll } from './layout.jsx';
import { MonkeyTiny, TurtleTiny } from './mascots.jsx';
import { EntryBlock } from './Today.jsx';
import {
  LANGS, PERIODS, computeStats, topLangs, listLangs, inPeriod, quietLangs,
  translations, memoryPool, nextSeed, memoryLabel,
} from './data.js';

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

// The period reads as a row of eyebrows: the chosen one in the accent, the
// rest quiet. It sits under the Him / Me / Both control.
function PeriodPicker({ value, onChange, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      {PERIODS.map(p => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            className="eyebrow"
            aria-pressed={active}
            onClick={() => onChange(p.key)}
            style={{
              border: 'none', background: 'transparent', padding: '4px 0',
              cursor: 'pointer', fontFamily: 'inherit',
              // Tighter than a plain eyebrow so all four fit one line on a
              // 320px phone.
              letterSpacing: 1, whiteSpace: 'nowrap',
              color: active ? accent : '#b8b3aa',
              transition: 'color .15s ease',
            }}>{p.label}</button>
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

// One line of the translation table: "When he gives Words, you answer with
// Time." and how many times that happened.
function TranslationRow({ give, answers, n, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <div style={{
        flex: 1,
        fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
        fontSize: 19, lineHeight: 1.3, color: '#1a1a1a',
      }}>
        When he gives <span style={{ color: accent }}>{listLangs([give])}</span>,
        you answer with <span style={{ color: accent }}>{listLangs(answers, 'or')}</span>.
      </div>
      <div style={{ fontSize: 11, color: '#9a958d', fontVariantNumeric: 'tabular-nums' }}>
        {n}×
      </div>
    </div>
  );
}

// One past moment, drawn at random. The seed lives here, so switching tabs
// keeps it and simply reads a different pool.
function RememberWhen({ pool, accent }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  if (pool.length === 0) return null;
  const memory = pool[seed % pool.length];

  return (
    <div data-memory style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid rgba(26,26,26,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">Remember when</div>
        {pool.length > 1 && (
          <button
            onClick={() => setSeed(s => nextSeed(s, pool.length))}
            style={{
              border: 'none', background: 'transparent', padding: '4px 0',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 500, color: accent,
            }}>Another</button>
        )}
      </div>
      <EntryBlock entry={memory} accent={accent} label={memoryLabel(memory)}/>
    </div>
  );
}

export function InsightsScreen({ entries, accent }) {
  const [view, setView] = useState('both');
  const [period, setPeriod] = useState('all');
  const phrase = PERIODS.find(p => p.key === period).phrase;
  const shown = inPeriod(entries, period);
  const stats = computeStats(shown);
  const echoes = view === 'both' ? translations(shown) : [];
  const halves = stats.monkeyTotal + stats.turtleTotal;
  const mTop  = topLangs(stats.monkey);
  const tTop  = topLangs(stats.turtle);

  // Him and Me each speak for one side only; Both reads the two together.
  const showM = view !== 'me'  && mTop.length > 0;
  const showT = view !== 'him' && tTop.length > 0;

  const side  = { him: 'monkey', me: 'turtle', both: 'both' }[view];
  const quiet = quietLangs(entries, side);
  const quietFrom = { him: ' from him', me: ' from you', both: '' }[view];

  const sorted = [...LANGS].sort((a, b) => {
    if (view === 'him') return stats.monkey[b.key] - stats.monkey[a.key];
    if (view === 'me')  return stats.turtle[b.key] - stats.turtle[a.key];
    return (stats.monkey[b.key] + stats.turtle[b.key])
         - (stats.monkey[a.key] + stats.turtle[a.key]);
  });

  return (
    <ScreenShell>
      <div style={{ padding: '22px 24px 22px' }}>
        <h1 className="page-title">Love, broken down.</h1>
      </div>

      <div style={{ padding: '0 24px 6px' }}>
        <Segmented
          value={view} onChange={setView} accent={accent}
          options={[
            { value: 'him',  label: 'Him' },
            { value: 'me',   label: 'Me' },
            { value: 'both', label: 'Both' },
          ]}/>
        <div style={{ marginTop: 18 }}>
          <PeriodPicker value={period} onChange={setPeriod} accent={accent}/>
        </div>
      </div>

      <ScreenScroll>
        <div style={{ padding: '20px 24px 110px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {halves === 0 ? (
            <div style={{
              paddingTop: 16,
              fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
              fontSize: 17, color: '#b8b3aa', fontStyle: 'italic', lineHeight: 1.4,
            }}>{period === 'all'
                  ? <>No moments logged yet.<br/>Start with Today.</>
                  : <>Nothing logged {phrase} yet.</>}</div>
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

          {(showM || showT || quiet.length > 0) && (
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
                  <>Monkey {mTop.length > 1 ? 'splits between' : 'leans into'} <span style={{ color: accent }}>{listLangs(mTop)}</span>.</>
                )}
                {showM && showT && <br/>}
                {showT && (
                  <>{view === 'me'
                      ? (tTop.length > 1 ? 'You split between' : 'You lean into')
                      : 'You return it in'} <span style={{ color: accent }}>{listLangs(tTop)}</span>.</>
                )}
              </div>
              {quiet.length > 0 && (
                <div data-quiet style={{
                  fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
                  fontSize: 17, lineHeight: 1.35, fontStyle: 'italic',
                  color: '#9a958d', marginTop: 10,
                }}>
                  {listLangs(quiet)} {quiet.length > 1 ? 'have' : 'has'} been quiet{quietFrom} lately.
                </div>
              )}
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

          {echoes.length > 0 && (
            <div data-translation style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid rgba(26,26,26,0.08)' }}>
              <div className="eyebrow">Translation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                {echoes.map(r => <TranslationRow key={r.give} {...r} accent={accent}/>)}
              </div>
            </div>
          )}

          <RememberWhen pool={memoryPool(entries, side)} accent={accent}/>
        </div>
      </ScreenScroll>
    </ScreenShell>
  );
}
