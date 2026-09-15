// DELETE /api/entries/:id?kind=pair|half - remove a pair, or one half.
//
// The id alone does not say which it is. A pair_id and a row id are separate
// spaces that may hold the same string - GET namespaces them (`p:` / `s:`) for
// exactly that reason - so the caller names the space and the handler runs the
// one predicate for it. Matching both at once would let a half id sweep an
// unrelated pair that happened to share the string.
//
//   kind=pair  every row of that pair - at most two, so a pair is never left
//              as an orphaned single
//   kind=half  that one row, by primary key - the other half of its pair, if
//              any, survives with the moment
//
// An unpaired moment is its half, so it is deleted with kind=half.

// A Map, not an object literal: a lookup by an arbitrary query string must
// not reach Object.prototype and hand back `constructor` as a statement.
const DELETE_BY = new Map([
  ['pair', 'DELETE FROM moments WHERE pair_id = ?'],
  ['half', 'DELETE FROM moments WHERE id = ?'],
]);

export async function onRequestDelete({ params, request, env }) {
  const id = String(params.id);
  const kind = new URL(request.url).searchParams.get('kind');
  const sql = DELETE_BY.get(kind);

  if (!sql) return Response.json({ error: 'Invalid request' }, { status: 400 });

  try {
    const { meta } = await env.DB.prepare(sql).bind(id).run();

    return Response.json({ ok: true, deleted: meta?.changes ?? 0 });
  } catch (err) {
    console.error('DELETE /api/entries/:id', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
