// Data helpers and date utilities.
// Every entry is written from Turtle's perspective: what Monkey did for me,
// and what I did for Monkey.

export const LANGS = [
  { key: 'words', label: 'Words', long: 'Words of affirmation' },
  { key: 'acts',  label: 'Acts',  long: 'Acts of service' },
  { key: 'touch', label: 'Touch', long: 'Physical touch' },
  { key: 'gifts', label: 'Gifts', long: 'Gifts' },
  { key: 'time',  label: 'Time',  long: 'Quality time' },
];

export const LANG_BY_KEY = Object.fromEntries(LANGS.map(l => [l.key, l]));

export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const DAYS_TINY    = ['S','M','T','W','T','F','S'];

// Local-time ISO date. Deliberately not toISOString(), which is UTC and
// would roll the date over early or late depending on the timezone.
export function localDateISO(date = new Date()) {
  return (
    date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export function localTime(date = new Date()) {
  return (
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0')
  );
}

// Computed once per page load. Good enough for a daily journal.
export const TODAY_ISO = localDateISO();
export const TODAY = (() => {
  const [y, m, d] = TODAY_ISO.split('-').map(Number);
  return { y, m: m - 1, d };   // m is 0-based, matching the Date constructor
})();

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function dateToISO({ y, m, d }) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function weekday(iso) {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m, d).getDay();
}

export const isToday  = (iso) => iso === TODAY_ISO;
export const isFuture = (iso) => iso > TODAY_ISO;   // ISO dates sort lexically

export function formatDateHeader(iso) {
  const { m, d } = parseISO(iso);
  return { weekday: DAYS_SHORT[weekday(iso)], month: MONTHS_SHORT[m], day: d };
}

export function relativeLabel(iso) {
  if (iso === TODAY_ISO) return 'Today';
  const t = parseISO(TODAY_ISO);
  const e = parseISO(iso);
  const diff = Math.round(
    (new Date(t.y, t.m, t.d) - new Date(e.y, e.m, e.d)) / 86400000
  );
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DAYS_SHORT[weekday(iso)];
  return MONTHS_SHORT[e.m] + ' ' + e.d;
}

// Newest first, by date then time.
//
// Returning 0 for the same minute is the whole point. Array.prototype.sort is
// stable, so moments that tie keep the order they arrived in - and that order
// is already newest-first, both from the API and from the optimistic prepend.
// A comparator that never returns 0 claims a is before b AND b is before a,
// which reversed every same-minute run and pushed a just-saved moment under
// the one before it.
export function newestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.time !== b.time) return a.time < b.time ? 1 : -1;
  return 0;
}

export function sortDesc(entries) {
  return [...entries].sort(newestFirst);
}

export function groupByDate(entries) {
  const map = new Map();
  for (const e of sortDesc(entries)) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return Array.from(map.entries()).map(([date, es]) => ({ date, entries: es }));
}

// A half is 'empty' (untouched), 'complete' (text + love language), or
// 'partial' (one without the other). Only a partial half blocks Save.
export function halfStatus(half) {
  const text = (half?.text || '').trim();
  const lang = half?.lang || '';
  if (!text && !lang) return 'empty';
  if (text && lang) return 'complete';
  return 'partial';
}

// Save needs at least one complete half and no half-filled one. A half the
// writer never touched is not an omission, so it never blocks.
export function composerState(monkey, turtle) {
  const m = halfStatus(monkey);
  const t = halfStatus(turtle);

  const incomplete = [];
  if (m === 'partial') incomplete.push('monkey');
  if (t === 'partial') incomplete.push('turtle');

  return {
    monkey: m,
    turtle: t,
    incomplete,
    canSave: (m === 'complete' || t === 'complete') && incomplete.length === 0,
  };
}

// What a partial half is missing. Empty string when nothing is wrong.
export function halfHint(half) {
  const text = (half?.text || '').trim();
  const lang = half?.lang || '';
  if (text && !lang) return 'Pick a love language.';
  if (!text && lang) return 'Add a few words.';
  return '';
}

export function newId(prefix = '') {
  return prefix + crypto.randomUUID();
}

// Builds the object the composer saves: the optimistic feed item AND the POST
// body, which are deliberately the same shape. Returns null when the sheet is
// not in a saveable state. Lives here, not in Sheet.jsx, so the wire format is
// testable against the API without a DOM.
export function buildMoment(monkey, turtle, now = new Date()) {
  const state = composerState(monkey, turtle);
  if (!state.canSave) return null;

  const monkeyHalf = state.monkey === 'complete'
    ? { id: newId('m-'), text: monkey.text.trim(), lang: monkey.lang }
    : null;
  const turtleHalf = state.turtle === 'complete'
    ? { id: newId('t-'), text: turtle.text.trim(), lang: turtle.lang }
    : null;

  // Two halves saved together are a pair; one on its own has no pair.
  const pairId = monkeyHalf && turtleHalf ? newId('p-') : null;

  return {
    id: pairId || (monkeyHalf ? monkeyHalf.id : turtleHalf.id),
    pairId,
    date: localDateISO(now),
    time: localTime(now),
    monkey: monkeyHalf,
    turtle: turtleHalf,
  };
}

// A moment is identified by the pair it belongs to, or, unpaired, by its lone
// half's own row id. Both are compared because the two id spaces overlap: a
// lone half may carry the same id as an unrelated pair's pairId.
const isSameMoment = (a, b) => a.pairId === b.pairId && a.id === b.id;

// Removes one half from the entries list.
//
// halfId is the row's PRIMARY KEY, so the match is exact where a moment id
// would be ambiguous. The other half surviving keeps the moment with that side
// null; the last half takes the moment with it.
export function removeHalf(entries, who, halfId) {
  const other = who === 'monkey' ? 'turtle' : 'monkey';
  const out = [];

  for (const e of entries) {
    if (e[who]?.id !== halfId) { out.push(e); continue; }
    if (e[other]) out.push({ ...e, [who]: null });
    // else: that was the last half, so the moment goes with it
  }

  return out;
}

// Puts one half back after its delete failed - and only that half.
//
// The other side is deliberately never taken from `moment`. If the moment is
// still in the list, what it holds now is the truth. If it is gone, it has no
// halves left, which means the other side was either already absent or deleted
// while this request was in flight - so restoring the whole snapshot would
// resurrect a half the server really did delete. That also makes the snapshot
// safe to be one render stale.
export function restoreHalf(entries, index, moment, who) {
  const other = who === 'monkey' ? 'turtle' : 'monkey';
  const found = entries.findIndex((e) => isSameMoment(e, moment));

  if (found !== -1) {
    const next = [...entries];
    next[found] = { ...next[found], [who]: moment[who] };
    return next;
  }

  const at = Math.min(Math.max(index, 0), entries.length);
  return [
    ...entries.slice(0, at),
    { ...moment, [other]: null, [who]: moment[who] },
    ...entries.slice(at),
  ];
}

// The line to show when a delete fails. Unlike loadFailure this never moves
// the gate: the journal on screen is fine, one request was not.
export function deleteFailure(err) {
  if (err?.status === 401) return 'Your session expired. Reload to sign in again.';
  return 'That could not be deleted. Please try again.';
}

export function computeStats(entries) {
  const blank = () => Object.fromEntries(LANGS.map(l => [l.key, 0]));
  const monkey = blank();
  const turtle = blank();

  // Halves are independent now, so each subject is counted against its own
  // halves. Using the moment count would let a lone Turtle half shrink every
  // Monkey bar.
  let monkeyTotal = 0;
  let turtleTotal = 0;

  for (const e of entries) {
    if (e.monkey && monkey[e.monkey.lang] !== undefined) {
      monkey[e.monkey.lang]++;
      monkeyTotal++;
    }
    if (e.turtle && turtle[e.turtle.lang] !== undefined) {
      turtle[e.turtle.lang]++;
      turtleTotal++;
    }
  }

  return { monkey, turtle, monkeyTotal, turtleTotal, momentCount: entries.length };
}

// Every language tied for the highest count, in LANGS order. Empty when this
// subject has nothing logged - seeding at -1 once handed back the first
// language and claimed a lean that was never recorded. A tie is returned as a
// tie; picking one would claim a favourite the journal has not seen.
export function topLangs(counts) {
  let bestN = 0;
  for (const n of Object.values(counts)) if (n > bestN) bestN = n;
  if (bestN === 0) return [];
  return LANGS.map(l => l.key).filter(k => counts[k] === bestN);
}

// "Time", "Time and Touch", "Words, Time and Touch".
export function listLangs(keys) {
  const labels = keys.map(k => LANG_BY_KEY[k].label);
  if (labels.length <= 1) return labels.join('');
  return labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
}

// Where the shell should go when loading the journal fails. A 401 is the
// ordinary locked state. Anything else - a missing APP_PASSWORD (503), a
// database error, a dead connection - means there is no journal to show, and
// rendering the feed would pass a broken server off as a quiet day.
export function loadFailure(err) {
  if (err?.status === 401) return { gate: 'locked', message: '' };

  // No status means fetch itself failed. Its message ("Failed to fetch") is
  // browser noise, so it is replaced rather than shown.
  if (!err?.status) {
    return {
      gate: 'unavailable',
      message: 'Could not reach the journal. Check your connection and try again.',
    };
  }

  // The server's own line is the useful one: the 503 says the secret is
  // missing, which is exactly what the reader needs to know.
  return {
    gate: 'unavailable',
    message: err.message || `The journal could not be loaded (${err.status}).`,
  };
}
