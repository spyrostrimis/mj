// App shell - the responsive phone frame, bottom tabs, and the top-level
// App component that owns auth state, entries, and overlay state.

import { useState, useEffect } from 'react';
import { TodayIcon, InsightsIcon } from './icons.jsx';
import { TodayScreen } from './Today.jsx';
import { InsightsScreen } from './Insights.jsx';
import { CalendarScreen } from './Calendar.jsx';
import { QuickSheet } from './Sheet.jsx';
import { LockScreen } from './Lock.jsx';
import * as api from './api.js';

const ACCENT   = '#8a6e4e';
const APP_W    = 402;
const APP_H    = 874;
const FRAME_BP = 720;

function BottomTabs({ active, onChange, accent }) {
  const tabs = [
    { id: 'today',    label: 'Today',    icon: TodayIcon },
    { id: 'insights', label: 'Insights', icon: InsightsIcon },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      background: 'rgba(250,250,247,0.92)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      borderTop: '1px solid rgba(26,26,26,0.06)',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '10px 0 14px' }}>
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
function PhoneFrame({ children }) {
  const { w, h } = useViewport();

  if (w < FRAME_BP) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#fafaf7', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}/>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    );
  }

  const scale = Math.min((w - 48) / APP_W, (h - 48) / APP_H, 1);

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
          <div style={{
            width: '100%', height: '100%',
            borderRadius: 48, overflow: 'hidden',
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
              <span>9:41</span>
              <span style={{ width: 100 }}/>
              <span style={{ fontSize: 11, opacity: 0.75, letterSpacing: 0.4 }}>5G {'▮▮▮'}</span>
            </div>
            <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}>
              {children}
            </div>
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
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontSize: 17, color: '#9a958d', fontStyle: 'italic', lineHeight: 1.5,
    }}>{children}</div>
  );
}

export function App() {
  // null = still checking, false = locked, true = unlocked
  const [unlocked, setUnlocked] = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loadError, setError]   = useState('');
  const [tab, setTab]           = useState('today');
  const [calendar, setCalendar] = useState(false);
  const [sheet, setSheet]       = useState(false);

  const fetchEntries = async () => {
    try {
      setEntries(await api.loadEntries());
      setError('');
      setUnlocked(true);
    } catch (err) {
      if (err.status === 401) { setUnlocked(false); return; }
      setError(err.message || 'Could not reach the journal.');
      setUnlocked(true);
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

  if (unlocked === null) {
    return <PhoneFrame><Centered>{'Opening…'}</Centered></PhoneFrame>;
  }

  if (unlocked === false) {
    return (
      <PhoneFrame>
        <LockScreen accent={ACCENT} onUnlock={fetchEntries}/>
      </PhoneFrame>
    );
  }

  let screen;
  if (tab === 'insights') {
    screen = <InsightsScreen entries={entries} accent={ACCENT}/>;
  } else if (calendar) {
    screen = <CalendarScreen entries={entries} accent={ACCENT} onBack={() => setCalendar(false)}/>;
  } else {
    screen = (
      <TodayScreen
        entries={entries}
        accent={ACCENT}
        onCal={() => setCalendar(true)}
        onNew={() => setSheet(true)}/>
    );
  }

  return (
    <PhoneFrame>
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
          onChange={(id) => { setTab(id); if (id !== 'today') setCalendar(false); }}/>
      )}

      <QuickSheet
        open={sheet}
        accent={ACCENT}
        onClose={() => setSheet(false)}
        onSave={handleSave}/>
    </PhoneFrame>
  );
}
