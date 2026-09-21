// Trips - the quiet one.
//
// The 9:41 in the phone frame is an Apple screenshot convention, not a clock.
// That is what makes it usable: nobody reads a status bar, so a date written
// as a time sits there as decoration and nothing about it invites a tap.
//
// A trip on 21 September becomes 9:21 - month in the hour, day in the minutes.
// The mapping cannot overflow: months are 1-12, exactly the range a 12-hour
// clock shows, and days are 1-31, all of them valid minutes. So every date in
// this list reads as a plausible time, which is the whole trick.
//
// Nothing here touches the journal. No API, no database, no love languages -
// these are hard-coded memories, not entries.

import { MONTHS_SHORT, parseISO } from './data.js';

// What the frame shows when there is no trip to show: Apple's own stock time.
export const FALLBACK_CLOCK = '9:41';

// The trips. Add one line per trip; the clock set rebuilds itself.
//
//   date  - 'YYYY-MM-DD', the day of the trip. This is what becomes the clock.
//   place - shown large in the sheet.
//   photos - a list of paths under public/, e.g. ['/trips/napoli-1.webp'].
//            One is chosen per page load, so a trip with several reshuffles
//            on refresh exactly as the clock does. Optional.
//   photo  - shorthand for a trip with only one. Optional. `photos` wins.
//   note  - one quiet line under the date. Optional.
//
// TEST FAKE placeholders until the real ones arrive.
export const TRIPS = [
  {
    date:  '2026-09-21',
    place: 'Napoli',
    // Several, to show the shuffle - and all three shapes, so the sheet's
    // aspect handling is exercised by the placeholders themselves.
    photos: [
      '/trips/placeholder-1.svg',
      '/trips/placeholder-2.svg',
      '/trips/placeholder-3.svg',
    ],
    note:  'TEST FAKE - the one with the rain and the pizza.',
  },
  {
    date:  '2026-05-08',
    place: 'Lisboa',
    photo: '/trips/placeholder-2.svg',
    note:  'TEST FAKE - a placeholder trip.',
  },
  {
    date:  '2026-11-03',
    place: 'Wien',
    photo: '/trips/placeholder-3.svg',
    note:  'TEST FAKE - a placeholder trip.',
  },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// A trip only earns a slot if its date can actually pass for a time. A bad
// month would render 0:xx or 19:xx in a 12-hour bar and give the game away, so
// it is dropped rather than shown.
export function isShowable(trip) {
  if (!trip || typeof trip.date !== 'string' || !ISO.test(trip.date)) return false;
  if (!trip.place || !String(trip.place).trim()) return false;
  const { m, d } = parseISO(trip.date);
  return m >= 0 && m <= 11 && d >= 1 && d <= 31;
}

// 'M:DD' - no leading zero on the hour, two digits on the minutes, because
// that is how a clock is written. 2026-09-05 -> '9:05'.
export function clockFor(trip) {
  if (!isShowable(trip)) return FALLBACK_CLOCK;
  const { m, d } = parseISO(trip.date);
  return (m + 1) + ':' + String(d).padStart(2, '0');
}

// The payoff line: the date the clock was hiding, spelled out.
export function tripDateLabel(trip) {
  if (!isShowable(trip)) return '';
  const { y, m, d } = parseISO(trip.date);
  return MONTHS_SHORT[m] + ' ' + d + ' · ' + y;
}

// A trip belongs to its month and day in EVERY year, not just the one it
// happened in. 21 September is Napoli whichever year the calendar is showing -
// which is the same rule the status bar clock follows, since 9:21 carries no
// year either.
//
// Two trips on the same month and day would collide; the first in the list
// wins, deliberately, so the calendar never changes its mind between taps.
export function tripForDate(iso, trips = TRIPS) {
  if (typeof iso !== 'string' || !ISO.test(iso)) return null;
  const key = iso.slice(5);   // 'MM-DD'
  return (trips || []).find((t) => isShowable(t) && t.date.slice(5) === key) || null;
}

// The look of something that can be tapped but must not admit it: no pointer
// cursor, no selection, no tap highlight. Deliberately sets no colour, size or
// weight - everything visible is inherited, so the text reads exactly as it
// did before it became a door.
export const SILENT_TAP = {
  cursor: 'default',
  userSelect: 'none', WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

// `random` is injectable so a test can pin the choice; production passes none.
export function pickTrip(trips = TRIPS, random = Math.random) {
  const showable = (trips || []).filter(isShowable);
  if (showable.length === 0) return null;
  const i = Math.floor(random() * showable.length);
  // A random() of exactly 1 is out of contract but costs nothing to survive.
  return showable[Math.min(i, showable.length - 1)];
}

// Every photo a trip has, in one shape, whichever way it was written. Blanks
// and non-strings are dropped rather than handed to an <img> as a src.
export function photosOf(trip) {
  const list = Array.isArray(trip?.photos)
    ? trip.photos
    : (trip?.photo ? [trip.photo] : []);
  return list.filter((p) => typeof p === 'string' && p.trim());
}

// `random` is injectable so a test can pin the choice; production passes none.
export function pickPhoto(trip, random = Math.random) {
  const list = photosOf(trip);
  if (list.length === 0) return null;
  return list[Math.min(Math.floor(random() * list.length), list.length - 1)];
}

// One photo per trip, chosen the first time that trip is asked for and then
// held for the life of the page - the same lifetime as the clock's own choice.
// So a refresh reshuffles every trip, while opening the same trip twice in one
// session shows the same photo both times. Keyed on the trip object, so a
// fixture that is not from TRIPS is just as stable.
//
// Without the memo the pick would run on every render and the photo would
// change under a sheet that is already open.
const CHOSEN_PHOTO = new WeakMap();

export function photoFor(trip) {
  if (!trip) return null;
  if (!CHOSEN_PHOTO.has(trip)) CHOSEN_PHOTO.set(trip, pickPhoto(trip));
  return CHOSEN_PHOTO.get(trip);
}

// Chosen once, when the bundle loads - the same lifetime as TODAY_ISO in
// data.js. That is precisely the requirement: a new trip on every refresh,
// and the same one all the way through a session, so moving between Today,
// Calendar and Insights never reshuffles the clock.
export const SHOWN_TRIP  = pickTrip();
export const SHOWN_CLOCK = SHOWN_TRIP ? clockFor(SHOWN_TRIP) : FALLBACK_CLOCK;
