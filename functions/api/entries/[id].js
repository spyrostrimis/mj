// DELETE /api/entries/:id - remove one moment.
//
// The id is the moment's id as the feed sees it: a pair's pair_id, or a lone
// half's own id. Deleting by pair_id takes both halves, so a pair can never be
// left as an orphaned single.

export async function onRequestDelete({ params, env }) {
  const id = String(params.id);

  try {
    const { meta } = await env.DB
      .prepare('DELETE FROM moments WHERE id = ? OR pair_id = ?')
      .bind(id, id)
      .run();

    return Response.json({ ok: true, deleted: meta?.changes ?? 0 });
  } catch (err) {
    console.error('DELETE /api/entries/:id', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
