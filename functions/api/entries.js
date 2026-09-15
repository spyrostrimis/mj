// GET  /api/entries - every moment, newest first
// POST /api/entries - save one half of a moment, or both
//
// A row is one half. A moment is either a pair - two rows sharing a pair_id,
// written together - or a single half with no pair.

const VALID_LANGS = new Set(['words', 'acts', 'touch', 'gifts', 'time']);
const SUBJECTS = ['monkey', 'turtle'];
const MAX_TEXT = 2000;
const MAX_ID = 64;

const LABEL = { monkey: "Monkey's", turtle: "Turtle's" };

const SELECT_ALL =
  `SELECT id, pair_id, subject, lang, body, entry_date, entry_time
     FROM moments
    ORDER BY entry_date DESC, entry_time DESC, id DESC`;

const INSERT_HALF =
  `INSERT INTO moments (id, pair_id, subject, lang, body, entry_date, entry_time)
   VALUES (?, ?, ?, ?, ?, ?, ?)`;

// Collapse per-half rows into one item per moment. Halves of a pair need not
// be adjacent: the Map keeps insertion order, so a moment sits where its first
// row appeared, which keeps the feed ordering deterministic.
export function groupRows(rows) {
  const byKey = new Map();

  for (const row of rows) {
    // Namespaced so a pair_id can never collide with a lone half's own id.
    const key = row.pair_id ? `p:${row.pair_id}` : `s:${row.id}`;
    let moment = byKey.get(key);

    if (!moment) {
      moment = {
        id: row.pair_id || row.id,
        pairId: row.pair_id || null,
        date: row.entry_date,
        time: row.entry_time,
        monkey: null,
        turtle: null,
      };
      byKey.set(key, moment);
    }

    moment[row.subject] = { id: row.id, text: row.body, lang: row.lang };
  }

  return Array.from(byKey.values());
}

const badRequest = (error) => Response.json({ error }, { status: 400 });

// Returns a problem sentence, or null when the half is complete.
function checkHalf(half, subject) {
  const who = LABEL[subject];
  if (typeof half !== 'object' || Array.isArray(half)) return 'Invalid request';
  if (typeof half.id !== 'string' || !half.id || half.id.length > MAX_ID) return 'Invalid request';
  if (typeof half.text !== 'string' || !half.text.trim()) return `${who} half needs a few words.`;
  if (half.text.trim().length > MAX_TEXT) return `${who} half is too long.`;
  if (!VALID_LANGS.has(half.lang)) return `${who} half needs a love language.`;
  return null;
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(SELECT_ALL).all();
    return Response.json(groupRows(results));
  } catch (err) {
    console.error('GET /api/entries', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return badRequest('Invalid request');
  }

  const { pairId, date, time } = body;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return badRequest('Invalid date or time');
  }

  // A half is "submitted" if it is present at all. Every submitted half must
  // be complete; an absent half is fine, a half-filled one is not.
  const submitted = SUBJECTS.filter((s) => body[s] !== undefined && body[s] !== null);
  if (submitted.length === 0) return badRequest('Nothing to save.');

  for (const subject of submitted) {
    const problem = checkHalf(body[subject], subject);
    if (problem) return badRequest(problem);
  }

  const paired = submitted.length === 2;

  if (paired) {
    if (typeof pairId !== 'string' || !pairId || pairId.length > MAX_ID) {
      return badRequest('Invalid request');
    }
    if (body.monkey.id === body.turtle.id) return badRequest('Invalid request');
  } else if (pairId !== undefined && pairId !== null) {
    return badRequest('Invalid request');
  }

  const rows = submitted.map((subject) => ({
    id: body[subject].id,
    pair_id: paired ? pairId : null,
    subject,
    lang: body[subject].lang,
    body: body[subject].text.trim(),
    entry_date: date,
    entry_time: time,
  }));

  try {
    const statements = rows.map((r) =>
      env.DB.prepare(INSERT_HALF).bind(
        r.id, r.pair_id, r.subject, r.lang, r.body, r.entry_date, r.entry_time
      )
    );

    // batch() is a SQL transaction: if the second half collides, neither half
    // is written. D1 does not accept explicit BEGIN/COMMIT.
    if (statements.length > 1) await env.DB.batch(statements);
    else await statements[0].run();

    return Response.json({ ok: true, entry: groupRows(rows)[0] }, { status: 201 });
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err.message)) {
      return Response.json({ error: 'That moment was already saved.' }, { status: 409 });
    }
    console.error('POST /api/entries', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
