// Today screen - reverse-chronological feed grouped by day.
// Today's entries come first (or an italic empty state); earlier days
// follow under date dividers.

import { ScreenShell, ScreenScroll } from './layout.jsx';
import { MonkeyTiny, TurtleTiny } from './mascots.jsx';
import { CalIcon, PlusIcon } from './icons.jsx';
import {
  LANG_BY_KEY, TODAY, TODAY_ISO, DAYS_SHORT, MONTHS_SHORT,
  groupByDate, weekday, formatDateHeader, relativeLabel,
} from './data.js';

function TodayHeader({ onCal }) {
  const eyebrow =
    DAYS_SHORT[weekday(TODAY_ISO)] + ' · ' + MONTHS_SHORT[TODAY.m] + ' ' + TODAY.d;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '18px 24px 12px',
    }}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title" style={{ marginTop: 6 }}>Today</h1>
      </div>
      <button className="icon-btn" onClick={onCal} aria-label="Calendar">
        <CalIcon size={22} color="#5a554c"/>
      </button>
    </div>
  );
}

export function LangChip({ langKey, accent }) {
  const l = LANG_BY_KEY[langKey];
  if (!l) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2.5px 9px',
      fontSize: 11, fontWeight: 500, letterSpacing: 0.2,
      border: '1px solid ' + accent + '33',
      color: accent, background: accent + '0d',
      borderRadius: 100, lineHeight: 1.3,
    }}>{l.label}</span>
  );
}

function EntryHalf({ who, half, accent }) {
  const Mascot = who === 'monkey' ? MonkeyTiny : TurtleTiny;
  const label  = who === 'monkey' ? 'Monkey' : 'I';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Mascot size={14} color="#5a554c"/>
        <span style={{ fontSize: 11.5, color: '#5a554c', letterSpacing: 0.3, fontWeight: 500 }}>{label}</span>
        <span style={{ width: 3, height: 3, borderRadius: 3, background: '#cfc9bf', margin: '0 2px' }}/>
        <LangChip langKey={half.lang} accent={accent}/>
      </div>
      <div style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 17, lineHeight: 1.45, color: '#1a1a1a',
        fontStyle: 'italic', letterSpacing: 0.1,
      }}>{half.text}</div>
    </div>
  );
}

export function EntryBlock({ entry, accent }) {
  return (
    <div style={{ padding: '18px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        fontSize: 11, color: '#9a958d', letterSpacing: 1.2,
        textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums', fontWeight: 500,
      }}>{entry.time}</div>
      <EntryHalf who="monkey" half={entry.monkey} accent={accent}/>
      <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '2px 0 2px 22px' }}/>
      <EntryHalf who="turtle" half={entry.turtle} accent={accent}/>
    </div>
  );
}

function DayDivider({ iso }) {
  const { day, month } = formatDateHeader(iso);
  const rel = relativeLabel(iso);
  const suffix =
    (rel !== 'Today' && rel !== 'Yesterday' && rel.length <= 3)
      ? ' · ' + month + ' ' + day
      : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 6px' }}>
      <span style={{
        fontSize: 11, color: '#9a958d', letterSpacing: 1.4,
        textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap',
      }}>{rel}{suffix}</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(26,26,26,0.08)' }}/>
    </div>
  );
}

function TodayEmpty({ accent }) {
  return (
    <div style={{
      padding: '24px 0 18px',
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontSize: 19, lineHeight: 1.4, color: '#9a958d', fontStyle: 'italic',
    }}>
      Nothing yet today.<br/>
      <span style={{ fontSize: 15, color: '#b8b3aa' }}>
        Tap <span style={{ color: accent }}>+</span> when something small happens.
      </span>
    </div>
  );
}

function FAB({ onClick, accent }) {
  return (
    <button
      onClick={onClick}
      aria-label="Log a moment"
      style={{
        position: 'absolute', right: 20, bottom: 84,
        width: 56, height: 56, borderRadius: '50%',
        background: accent, color: '#fafaf7',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 20px -6px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.08)',
        transition: 'transform .15s ease',
        zIndex: 30,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
      <PlusIcon size={22}/>
    </button>
  );
}

export function TodayScreen({ entries, onCal, onNew, accent }) {
  const groups     = groupByDate(entries);
  const todayGroup = groups.find(g => g.date === TODAY_ISO);
  const earlier    = groups.filter(g => g.date !== TODAY_ISO);

  const renderDay = (list) =>
    list.map((e, i) => (
      <div key={e.id}>
        <EntryBlock entry={e} accent={accent}/>
        {i < list.length - 1 && (
          <div style={{ height: 1, background: 'rgba(26,26,26,0.06)' }}/>
        )}
      </div>
    ));

  return (
    <ScreenShell>
      <TodayHeader onCal={onCal}/>
      <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '0 24px' }}/>

      <ScreenScroll>
        <div style={{ padding: '0 24px 110px' }}>
          {todayGroup ? renderDay(todayGroup.entries) : <TodayEmpty accent={accent}/>}

          {earlier.map(g => (
            <div key={g.date}>
              <DayDivider iso={g.date}/>
              {renderDay(g.entries)}
            </div>
          ))}

          <div style={{
            padding: '32px 0 0', textAlign: 'center',
            fontSize: 11, color: '#b8b3aa', letterSpacing: 1.4, textTransform: 'uppercase',
          }}>Beginning of journal</div>
        </div>
      </ScreenScroll>

      <FAB onClick={onNew} accent={accent}/>
    </ScreenShell>
  );
}
