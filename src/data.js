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

export function sortDesc(entries) {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.time < b.time ? 1 : -1;
  });
}

export function groupByDate(entries) {
  const map = new Map();
  for (const e of sortDesc(entries)) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return Array.from(map.entries()).map(([date, es]) => ({ date, entries: es }));
}

export function computeStats(entries) {
  const blank = () => Object.fromEntries(LANGS.map(l => [l.key, 0]));
  const monkey = blank();
  const turtle = blank();
  for (const e of entries) {
    if (monkey[e.monkey?.lang] !== undefined) monkey[e.monkey.lang]++;
    if (turtle[e.turtle?.lang] !== undefined) turtle[e.turtle.lang]++;
  }
  return { monkey, turtle, total: entries.length };
}

export function topLang(counts) {
  let best = null, bestN = -1;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; best = k; }
  }
  return best;
}
