// Applies the real migrations/ files to a fresh in-memory SQLite database.
//
// getPlatformProxy() and Miniflare both hang in this environment (a long-lived
// in-process workerd never becomes ready), so tests run against node:sqlite
// instead of real D1. The SQL under test is the same file wrangler applies.
// node:sqlite is a Node release candidate; it ships only in tests, never to
// Cloudflare.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
}

export function readMigration(name) {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

// A database with every migration applied, in filename order.
export function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  for (const file of migrationFiles()) db.exec(readMigration(file));
  return db;
}
