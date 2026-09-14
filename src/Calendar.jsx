// Calendar - monthly grid. Today is outlined, days with entries carry an
// accent dot, future days are dimmed and unreachable. Tapping a day shows
// its moments below the grid.

import { useState, useMemo } from 'react';
import { ScreenShell, ScreenScroll } from './layout.jsx';
import { EntryBlock } from './Today.jsx';
import { ChevronLeft, ChevronRight } from './icons.jsx';
import {
  TODAY, TODAY_ISO, DAYS_TINY, DAYS_SHORT, MONTHS_SHORT, MONTHS_LONG,
  dateToISO, parseISO, weekday, isToday, isFuture,
} from './data.js';

function MonthGrid({ year, month, selectedISO, entriesByDate, accent, onSelect }) {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '0 8px' }}>
      {DAYS_TINY.map((d, i) => (
        <div key={'h' + i} style={{
          textAlign: 'center', fontSize: 10.5, color: '#b8b3aa',
          letterSpacing: 1.2, padding: '6px 0 10px', fontWeight: 500,
        }}>{d}</div>
      ))}

      {cells.map((d, i) => {
        if (d === null) return <div key={'p' + i}/>;
        const iso   = dateToISO({ y: year, m: month, d });
        const fut   = isFuture(iso);
        const today = isToday(iso);
        const sel   = iso === selectedISO;
        const has   = !!entriesByDate[iso]?.length;
        return (
          <button
            key={iso}
            disabled={fut}
            onClick={() => onSelect(iso)}
            aria-label={iso}
            style={{
              aspectRatio: '1',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              border: 'none',
              background: sel ? accent : 'transparent',
              color: sel ? '#fafaf7' : (fut ? '#d9d3c8' : '#1a1a1a'),
              fontFamily: 'inherit',
              fontSize: 14.5, fontVariantNumeric: 'tabular-nums',
              fontWeight: (today && !sel) ? 600 : 400,
              borderRadius: 100,
              cursor: fut ? 'default' : 'pointer',
              transition: 'background .15s ease',
              outline: (today && !sel) ? '1px solid ' + accent + '66' : 'none',
              outlineOffset: -1,
            }}>
            <span style={{ lineHeight: 1 }}>{d}</span>
            <span style={{
              width: 4, height: 4, borderRadius: 4, marginTop: has ? -1 : 0,
              background: has ? (sel ? 'rgba(250,250,247,0.85)' : accent) : 'transparent',
            }}/>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarScreen({ entries, onBack, accent }) {
  const entriesByDate = useMemo(() => {
    const m = {};
    for (const e of entries) (m[e.date] = m[e.date] || []).push(e);
    for (const arr of Object.values(m)) arr.sort((a, b) => (a.time > b.time ? -1 : 1));
    return m;
  }, [entries]);

  const [view, setView]         = useState({ y: TODAY.y, m: TODAY.m });
  const [selected, setSelected] = useState(TODAY_ISO);

  const isCurrentMonth = view.y === TODAY.y && view.m === TODAY.m;

  const goPrev = () => setView(v => ({
    y: v.m === 0 ? v.y - 1 : v.y,
    m: v.m === 0 ? 11 : v.m - 1,
  }));

  const goNext = () => {
    if (isCurrentMonth) return;
    setView(v => ({
      y: v.m === 11 ? v.y + 1 : v.y,
      m: v.m === 11 ? 0 : v.m + 1,
    }));
  };

  const selDay = entriesByDate[selected] || [];
  const selLabel = selected === TODAY_ISO
    ? 'Today'
    : (() => {
        const { m, d } = parseISO(selected);
        return DAYS_SHORT[weekday(selected)] + ' · ' + MONTHS_SHORT[m] + ' ' + d;
      })();

  return (
    <ScreenShell>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 16px 14px',
      }}>
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} color="#5a554c"/>
        </button>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 22, letterSpacing: -0.3, color: '#1a1a1a',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{MONTHS_LONG[view.m] + ' ' + view.y}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft size={18} color="#5a554c"/>
          </button>
          <button
            className="icon-btn" onClick={goNext}
            disabled={isCurrentMonth} aria-label="Next month"
            style={{ opacity: isCurrentMonth ? 0.3 : 1 }}>
            <ChevronRight size={18} color="#5a554c"/>
          </button>
        </div>
      </div>

      <div style={{ padding: '4px 16px 12px' }}>
        <MonthGrid
          year={view.y} month={view.m}
          selectedISO={selected}
          entriesByDate={entriesByDate}
          accent={accent}
          onSelect={setSelected}/>
      </div>

      <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '4px 24px' }}/>

      <ScreenScroll>
        <div style={{ padding: '16px 24px 110px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div className="eyebrow">{selLabel}</div>
            <div style={{ fontSize: 11, color: '#9a958d', letterSpacing: 0.4 }}>
              {selDay.length === 0
                ? '—'
                : selDay.length + ' ' + (selDay.length === 1 ? 'moment' : 'moments')}
            </div>
          </div>

          {selDay.length === 0 ? (
            <div style={{
              paddingTop: 24,
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 17, color: '#b8b3aa', fontStyle: 'italic', lineHeight: 1.4,
            }}>Nothing logged on this day.</div>
          ) : (
            selDay.map((e, i) => (
              <div key={e.id}>
                <EntryBlock entry={e} accent={accent}/>
                {i < selDay.length - 1 && (
                  <div style={{ height: 1, background: 'rgba(26,26,26,0.06)' }}/>
                )}
              </div>
            ))
          )}
        </div>
      </ScreenScroll>
    </ScreenShell>
  );
}
