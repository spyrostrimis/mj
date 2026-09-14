// DELETE /api/entries/:id - remove one moment

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB
      .prepare('DELETE FROM moments WHERE id = ?')
      .bind(params.id)
      .run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/entries/:id', err.message);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
