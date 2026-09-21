// App shell - the responsive phone frame, bottom tabs, and the top-level
// App component that owns auth state, entries, and overlay state.

import { useState, useEffect } from 'react';
import { TodayIcon, CalIcon, InsightsIcon } from './icons.jsx';
import { TodayScreen } from './Today.jsx';
import { InsightsScreen } from './Insights.jsx';
import { CalendarScreen } from './Calendar.jsx';
import { QuickSheet } from './Sheet.jsx';
import { HalfSheet } from './HalfSheet.jsx';
import { LockScreen } from './Lock.jsx';
import { TripSheet } from './TripSheet.jsx';
import { SHOWN_TRIP, SHOWN_CLOCK, SILENT_TAP } from './trips.js';
import { UnavailableScreen } from './Unavailable.jsx';
import { loadFailure, removeHalf, restoreHalf, deleteFailure } from './data.js';
import * as api from './api.js';

const ACCENT   = '#8a6e4e';
const APP_W    = 402;
const APP_H    = 874;
const FRAME_BP = 720;

// The status bar clock, which is secretly a date.
//
// Everything here is about giving nothing away. It is a span, not a button, so
// there is no tab stop, no focus ring and nothing for a screen reader to
// announce; the cursor is pinned to default because a pointer is the loudest
// tell there is; there is no title attribute, so no tooltip; no hover, no
// colour change, no transition. It looks exactly like the 9:41 it replaced,
// and the only thing that happens on hover is nothing.
//
// The status bar row itself is pointerEvents:'none' - this is the one span
// that opts back in, so the rest of the bar stays inert.
//
// `inert` is what stops a second trip opening on top of the first. Every sheet
// the app owns lives inside the container at top:44, so its backdrop begins
// BELOW the status bar and never covers the clock - which left the clock live
// under the composer, the half actions and a trip opened from the calendar.
// Both halves are needed: pointerEvents stops a real tap, and dropping the
// handler stops a dispatched click, which is what a test sends.
function StatusClock({ onOpen, inert }) {
  if (!SHOWN_TRIP) return <span>{SHOWN_CLOCK}</span>;
  return (
    <span
      data-clock
      onClick={inert ? undefined : onOpen}
      style={{
        pointerEvents: inert ? 'none' : 'auto',
        ...SILENT_TAP,
      }}>{SHOWN_CLOCK}</span>
  );
}

function BottomTabs({ active, onChange, accent }) {
  const tabs = [
    { id: 'today',    label: 'Today',    icon: TodayIcon },
    { id: 'calendar', label: 'Calendar', icon: CalIcon },
    { id: 'insights', label: 'Insights', icon: InsightsIcon },
  ];
  return (
    <div data-tabs style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      background: 'rgba(250,250,247,0.92)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      borderTop: '1px solid rgba(26,26,26,0.06)',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '10px 0 14px' }}>
        {tabs.map(t => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '4px 18px', borderRadius: 12,
                color: isActive ? accent : '#9a958d',
                fontFamily: 'inherit', transition: 'color .15s ease',
              }}>
              <Icon size={22} color={isActive ? accent : '#9a958d'}/>
              <span style={{
                fontSize: 10.5, letterSpacing: 0.3,
                fontWeight: isActive ? 600 : 500,
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The frame clips; it is not a scroller. overflow:hidden still scrolls
// programmatically, and both sheets park below the fold at translateY(100%) -
// so a focus-into-view, an errant anchor or an assistive-tech call can scroll
// the closed composer into view over the screen. Snapping back makes the clip
// mean what it says.
const clipOnly = (e) => {
  if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
  if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
};

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

// Below 720px the app is full-bleed so it feels native on a phone.
// Above that it sits inside a scaled iOS frame, preserving the journal feel.
// `modal` says the app has something open over itself. The frame cannot see
// that on its own - the app's sheets are inside children - so App tells it.
function PhoneFrame({ children, modal }) {
  const { w, h } = useViewport();
  // Owned here rather than in App: the clock is part of the frame, and the
  // full-bleed phone layout has no status bar to hide anything in.
  const [trip, setTrip] = useState(false);

  if (w < FRAME_BP) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#fafaf7', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}/>
        <div className="frame-clip" onScroll={clipOnly} style={{ position: 'relative', flex: 1 }}>
          {children}
        </div>
      </div>
    );
  }

  // Clamped above zero: a viewport shorter than the 48px margin made this
  // negative, and a negative scale renders the whole app inverted rather than
  // small. A cramped window should crop the frame, never flip it.
  const scale = Math.max(Math.min((w - 48) / APP_W, (h - 48) / APP_H, 1), 0.2);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#ece8df',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{ transform: 'scale(' + scale + ')', transformOrigin: 'center' }}>
        <div style={{
          width: APP_W, height: APP_H,
          borderRadius: 56, position: 'relative', background: '#0a0a0a',
          boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 60px 120px -40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.4)',
          padding: 10,
        }}>
          <div className="frame-clip" onScroll={clipOnly} style={{
            width: '100%', height: '100%',
            borderRadius: 48,
            background: '#fafaf7', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              width: 118, height: 34, borderRadius: 22, background: '#0a0a0a', zIndex: 50,
            }}/>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '20px 30px 6px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 14, fontWeight: 600, color: '#1a1a1a',
              fontFamily: '-apple-system, "SF Pro", system-ui, sans-serif',
              zIndex: 40, pointerEvents: 'none',
            }}>
              <StatusClock
                inert={modal || trip}
                onOpen={() => setTrip(true)}/>
              <span style={{ width: 100 }}/>
              <span style={{ fontSize: 11, opacity: 0.75, letterSpacing: 0.4 }}>5G {'▮▮▮'}</span>
            </div>
            <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}>
              {children}
            </div>
            <TripSheet
              open={trip}
              trip={SHOWN_TRIP}
              accent={ACCENT}
              onClose={() => setTrip(false)}/>
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              width: 134, height: 5, borderRadius: 100,
              background: 'rgba(26,26,26,0.28)', zIndex: 60,
            }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#fafaf7', padding: '0 36px', textAlign: 'center',
      fontFamily: "'Instrument Serif', 'EB Garamond', Georgia, serif",
      fontSize: 17, color: '#9a958d', fontStyle: 'italic', lineHeight: 1.5,
    }}>{children}</div>
  );
}

export function App() {
  // 'checking' | 'locked' | 'open' | 'unavailable'
  const [gate, setGate]         = useState('checking');
  const [entries, setEntries]   = useState([]);
  // Why the journal could not be loaded. Only read by the unavailable screen.
  const [gateMessage, setGateMessage] = useState('');
  // Transient trouble with the journal already on screen - a failed save.
  const [loadError, setError]   = useState('');
  // 'today' | 'calendar' | 'insights' - the calendar is a tab, not a mode
  // layered over Today, so tapping Today always lands on Today.
  const [tab, setTab]           = useState('today');
  const [sheet, setSheet]       = useState(false);
  // The half whose actions are open, with everything a rollback needs:
  // { moment, who, half, index, lastHalf }.
  const [target, setTarget]     = useState(null);
  // The trip a calendar date turned out to be hiding. Separate from the status
  // bar clock's own sheet, which lives in the frame and never changes trip.
  const [tripDay, setTripDay]   = useState(null);

  const fetchEntries = async () => {
    try {
      setEntries(await api.loadEntries());
      setError('');
      setGateMessage('');
      setGate('open');
    } catch (err) {
      // A failed load never falls through to the feed: an empty journal and
      // a broken server must not look the same.
      const { gate: next, message } = loadFailure(err);
      setGateMessage(message);
      setGate(next);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleSave = async (entry) => {
    setSheet(false);
    setEntries(prev => [entry, ...prev]);   // optimistic
    try {
      await api.saveEntry(entry);
    } catch (err) {
      // Roll back so the feed never shows something that was not stored.
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      setError(
        err.status === 401
          ? 'Your session expired. Reload to sign in again.'
          : 'That moment could not be saved. Please try again.'
      );
    }
  };

  // The moment object is the same reference the feed rendered, so indexOf is
  // exact. A -1 would only cost the restored half its tie-break position,
  // since both screens re-derive order from date and time.
  const openHalf = (moment, who) => setTarget({
    moment,
    who,
    half: moment[who],
    index: entries.indexOf(moment),
    lastHalf: !moment[who === 'monkey' ? 'turtle' : 'monkey'],
  });

  const handleDeleteHalf = async () => {
    if (!target) return;
    const { who, half, moment, index } = target;
    setTarget(null);
    setEntries(prev => removeHalf(prev, who, half.id));   // optimistic
    try {
      // A 200 with deleted: 0 means it was already gone - the goal state
      // either way, so there is nothing to undo and nothing to say.
      await api.deleteEntry(half.id, 'half');
    } catch (err) {
      setEntries(prev => restoreHalf(prev, index, moment, who));
      setError(deleteFailure(err));
    }
  };

  if (gate === 'checking') {
    return <PhoneFrame><Centered>{'Opening…'}</Centered></PhoneFrame>;
  }

  if (gate === 'locked') {
    return (
      <PhoneFrame>
        <LockScreen accent={ACCENT} onUnlock={fetchEntries}/>
      </PhoneFrame>
    );
  }

  if (gate === 'unavailable') {
    return (
      <PhoneFrame>
        <UnavailableScreen accent={ACCENT} message={gateMessage} onRetry={fetchEntries}/>
      </PhoneFrame>
    );
  }

  let screen;
  if (tab === 'insights') {
    screen = <InsightsScreen entries={entries} accent={ACCENT}/>;
  } else if (tab === 'calendar') {
    screen = (
      <CalendarScreen
        entries={entries}
        accent={ACCENT}
        onHalfTap={openHalf}
        onTrip={setTripDay}
        onBack={() => setTab('today')}/>
    );
  } else {
    screen = (
      <TodayScreen
        entries={entries}
        accent={ACCENT}
        onCal={() => setTab('calendar')}
        onNew={() => setSheet(true)}
        onHalfTap={openHalf}/>
    );
  }

  return (
    // The status bar is outside every sheet the app opens, so the clock has to
    // be told when one is up. Without it the clock stays tappable through a
    // backdrop and opens a trip over whatever is already there.
    <PhoneFrame modal={sheet || !!target || !!tripDay}>
      {screen}

      {loadError && (
        <div
          onClick={() => setError('')}
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 150,
            background: '#1a1a1a', color: '#fafaf7',
            borderRadius: 12, padding: '11px 14px',
            fontSize: 12.5, lineHeight: 1.4, zIndex: 60, cursor: 'pointer',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
          }}>{loadError}</div>
      )}

      {!sheet && (
        <BottomTabs
          active={tab}
          accent={ACCENT}
          onChange={setTab}/>
      )}

      <QuickSheet
        open={sheet}
        accent={ACCENT}
        onClose={() => setSheet(false)}
        onSave={handleSave}/>

      <HalfSheet
        target={target}
        accent={ACCENT}
        onCancel={() => setTarget(null)}
        onDelete={handleDeleteHalf}/>

      <TripSheet
        open={!!tripDay}
        trip={tripDay}
        accent={ACCENT}
        onClose={() => setTripDay(null)}/>
    </PhoneFrame>
  );
}
