// GET  /api/entries - every moment, newest first
// POST /api/entries - save a new moment

const VALID_LANGS = new Set(['words', 'acts', 'touch', 'gifts', 'time']);
const MAX_TEXT = 2000;

function toEntry(row) {
  return {
    id: row.id,
    date: row.entry_date,
    time: row.entry_time,
    monkey: { text: row.monkey_text, lang: row.monkey_lang },
    turtle: { text: row.turtle_text, lang: row.turtle_lang },
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM moments ORDER BY entry_date DESC, entry_time DESC')
      .all();
    return Response.json(results.map(toEntry));
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
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { id, date, time, monkey, turtle } = body || {};

  if (!id || !date || !time || !monkey?.text || !turtle?.text) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!VALID_LANGS.has(monkey.lang) || !VALID_LANGS.has(turtle.lang)) {
    return Response.json({ error: 'Invalid love language' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return Response.json({ error: 'Invalid date or time' }, { status: 400 });
  }
  if (monkey.text.length > MAX_TEXT || turtle.text.length > MAX_TEXT) {
    return Response.json({ error: 'Entry is too long' }, { status: 400 });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO moments
         (id, entry_date, entry_time, monkey_text, monkey_lang, turtle_text, turtle_lang)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(id), date, time,
      monkey.text.trim(), monkey.lang,
      turtle.text.trim(), turtle.lang
    ).run();

    return Response.json({ ok: true });
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err.message)) {
      return Response.json({ error: 'Entry already exists' }, { status: 409 });
    }
    console.error('POST /api/entries', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
