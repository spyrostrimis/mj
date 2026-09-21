// Trip sheet - what the status bar clock opens.
//
// Same bottom sheet as the composer and the half actions, deliberately: the
// reward for finding the hidden thing should feel like part of the app, not
// like a lightbox bolted on.
//
// It follows HalfSheet's mount discipline rather than the composer's. The
// composer stays mounted forever and parks below the fold, which is how a
// focusable sheet ended up off-screen and dragged the frame with it. This one
// mounts on open and stays exactly long enough to slide out - inert, hidden
// and out of the tab order while it does.

import { useState, useEffect, useRef } from 'react';
import { tripDateLabel, photoFor } from './trips.js';

// Long enough to cover the .28s slide, short enough that nothing lingers.
const EXIT_MS = 320;

const SERIF = "'Instrument Serif', 'EB Garamond', Georgia, serif";

// A photo is shown at its own shape, so a portrait is not beheaded by a
// landscape crop. Clamped at both ends: anything taller than 3:4 would push
// the place and the date off the sheet, and anything wider than 2:1 would be
// a letterbox strip. Inside that range nothing is cropped at all, which is the
// point - the crop is a backstop for a photo that was never squared up, not
// the normal path.
//
// 3:4 is deliberately the tallest: it is the standard portrait photo, so the
// common case survives untouched and only a 9:16 screenshot gets trimmed.
const TALLEST = 3 / 4;
const WIDEST  = 2 / 1;

// Until a photo loads there is nothing to measure, so the frame holds the 4:3
// it has always drawn. A photo with no dimensions - not loaded, broken, an SVG
// without a size - keeps it too.
export const DEFAULT_RATIO = 4 / 3;

export function photoRatio(naturalWidth, naturalHeight) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return DEFAULT_RATIO;
  return Math.min(Math.max(naturalWidth / naturalHeight, TALLEST), WIDEST);
}

function Photo({ src, alt }) {
  const [broken, setBroken] = useState(false);
  const [ratio, setRatio]   = useState(DEFAULT_RATIO);

  // The frame is drawn either way, so a photo that has not arrived yet leaves
  // a warm blank rather than collapsing the sheet's whole layout.
  return (
    <div
      data-photo-frame
      style={{
        width: '100%', aspectRatio: ratio,
        borderRadius: 16, overflow: 'hidden',
        background: '#ece8df',
        boxShadow: 'inset 0 0 0 1px rgba(26,26,26,0.05)',
      }}>
      {src && !broken && (
        <img
          src={src}
          alt={alt}
          onLoad={(e) => setRatio(photoRatio(e.target.naturalWidth, e.target.naturalHeight))}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
      )}
    </div>
  );
}

export function TripSheet({ open, trip, accent, onClose }) {
  const [showing, setShowing] = useState(false);
  const [entered, setEntered] = useState(false);
  const closeRef = useRef(null);

  // The status bar clock always hands over the same trip, but the calendar
  // hands over a different one each time and clears it on close - and a panel
  // whose content vanishes unmounts mid-slide. Holding the last trip in a ref
  // read during render (not stashed by an effect, which runs a render too
  // late) keeps the same node on screen for the way out.
  const lastTrip = useRef(null);
  if (trip) lastTrip.current = trip;
  const t = trip || (showing ? lastTrip.current : null);

  // preventScroll for the same reason as the half sheet: the phone frame
  // clips with overflow:hidden, which is still programmatically scrollable,
  // and focusing something the browser thinks is off-screen makes it scroll
  // there - dragging the parked composer into view.
  const takeFocus = (el) => el?.focus?.({ preventScroll: true });

  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open) { setShowing(true); return; }
    if (!showing) return;
    // A timer rather than transitionend, which a hidden tab may never fire.
    const id = setTimeout(() => {
      lastTrip.current = null;
      setShowing(false);
    }, EXIT_MS);
    return () => clearTimeout(id);
  }, [open, showing]);

  useEffect(() => { if (entered) takeFocus(closeRef.current); }, [entered]);

  // Nothing to hand focus back to: the opener is a bare span, unfocusable on
  // purpose, because a focus ring is exactly the kind of tell that would give
  // the clock away. So focus is dropped instead of restored.
  const close = () => {
    onClose();
    if (closeRef.current === document.activeElement) closeRef.current?.blur?.();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      // One stop, so the trap is just "stay here".
      if (e.key === 'Tab') { e.preventDefault(); takeFocus(closeRef.current); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!t || (!open && !showing)) return null;

  const dateLabel = tripDateLabel(t);

  return (
    <>
      <div
        data-trip-backdrop
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
        data-trip-sheet
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-hidden={open ? undefined : 'true'}
        aria-label={open ? t.place + ', ' + dateLabel : undefined}
        style={{
          pointerEvents: open ? 'auto' : 'none',
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
          flex: 1, overflow: 'auto',
          padding: '8px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <Photo src={photoFor(t)} alt={t.place}/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{
              fontFamily: SERIF, fontSize: 30, lineHeight: 1.1,
              color: '#1a1a1a', letterSpacing: 0.2,
            }}>{t.place}</div>
            <div style={{
              fontSize: 11, color: '#9a958d', letterSpacing: 1.4,
              textTransform: 'uppercase', fontWeight: 500,
            }}>{dateLabel}</div>
          </div>

          {t.note && (
            <div style={{
              fontFamily: SERIF, fontSize: 16, lineHeight: 1.45,
              fontStyle: 'italic', color: '#5a554c', letterSpacing: 0.1,
            }}>{t.note}</div>
          )}

          <button
            ref={closeRef}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={close}
            style={{
              marginTop: 2, width: '100%', padding: '13px 16px',
              fontSize: 14, fontWeight: 500, letterSpacing: 0.2,
              border: 'none', borderRadius: 14, cursor: 'pointer',
              background: 'rgba(26,26,26,0.035)', color: accent,
              fontFamily: 'inherit', transition: 'background .15s ease',
            }}>Close</button>
        </div>
      </div>
    </>
  );
}
