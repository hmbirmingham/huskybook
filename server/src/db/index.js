import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { SCHEMA, runMigrations } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'huskybook.sqlite');

// With no TURSO_DATABASE_URL set, this is a plain local file — same
// zero-external-accounts local dev story as before (Phase 1's whole point).
// In production, TURSO_DATABASE_URL/TURSO_AUTH_TOKEN point this same
// client at a hosted Turso database instead. That's the entire reason
// this app reaches for libSQL rather than another driver: a free host
// with no persistent disk of its own (Render) can still keep data that
// survives a redeploy, without the app's own SQL or query code changing
// at all — only where the bytes live changes.
//
// DATABASE_URL is a third, explicit override on top of those two — used
// only by the test suite (server/test-helpers.js) to point each test run
// at its own throwaway file instead of the real dev database. It takes
// priority over TURSO_DATABASE_URL so a developer's local .env can't
// accidentally point a test run at production.
const usingTurso = Boolean(process.env.TURSO_DATABASE_URL);
const url = process.env.DATABASE_URL || (usingTurso ? process.env.TURSO_DATABASE_URL : `file:${LOCAL_DB_PATH}`);
if (!process.env.DATABASE_URL && !usingTurso) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// executeMultiple, not execute, for the schema: execute() silently runs
// only the first statement of a multi-statement string rather than
// erroring — confirmed by testing it directly before writing this file —
// so using it here would have meant tables after the first one in SCHEMA
// silently never getting created.
await db.executeMultiple('PRAGMA foreign_keys = ON;');
await db.executeMultiple(SCHEMA);
await runMigrations(db);
