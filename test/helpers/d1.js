// A D1Database-shaped wrapper over a node:sqlite database.
//
// Fidelity note: real D1 is not reachable from tests here (see test/helpers/
// migrate.js). batch() below models D1's documented contract - "Batched
// statements are SQL transactions. If a statement in the sequence fails, then
// an error is returned for that specific statement, and it aborts or rolls
// back the entire sequence" - with an explicit BEGIN/ROLLBACK, which is the
// one place these tests model D1 rather than exercise it. D1 itself does not
// accept BEGIN/COMMIT; that is why the handler uses batch().

class Statement {
  constructor(db, sql, args) {
    this.db = db;
    this.sql = sql;
    this.args = args ?? [];
  }

  bind(...args) {
    return new Statement(this.db, this.sql, args);
  }

  async run() {
    const info = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
  }

  async all() {
    const results = this.db.prepare(this.sql).all(...this.args);
    return { results, success: true, meta: {} };
  }

  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.args) ?? null;
    if (column) return row ? row[column] : null;
    return row;
  }
}

export function d1(db) {
  return {
    prepare(sql) {
      return new Statement(db, sql);
    },

    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec('COMMIT');
        return results;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    // Test-only escape hatch for asserting on raw rows.
    _raw: db,
  };
}
