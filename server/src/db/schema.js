// Schema is applied with CREATE TABLE IF NOT EXISTS on every boot instead of
// a migration runner — there's exactly one schema version right now, and a
// migration tool would be overhead with nothing to migrate between. If this
// grows past one or two shapes, reach for a real migration tool before
// hand-rolling versioning here.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS providers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('hair', 'nails', 'makeup', 'braids', 'other')),
  type            TEXT NOT NULL CHECK (type IN ('dorm', 'mobile')),
  building_zone   TEXT NOT NULL,
  exact_location  TEXT NOT NULL,
  specialties     TEXT NOT NULL DEFAULT '[]',
  price_range     TEXT,
  contact_method  TEXT NOT NULL,
  available       INTEGER NOT NULL DEFAULT 1,
  verified        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id     INTEGER NOT NULL REFERENCES providers(id),
  requester_name  TEXT NOT NULL,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_provider_id ON requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester_name ON requests(requester_name);

-- Auth: a user is just a verified @uconn.edu email address. login_tokens are
-- single-use magic-link tokens (only the sha256 hash is stored, same reason
-- you never store a password in plaintext); sessions are what a signed-in
-- browser actually holds, as an httpOnly cookie carrying this row's id.
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL,
  token_hash      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  used            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens(email);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;

// SQLite's ALTER TABLE has no "ADD COLUMN IF NOT EXISTS" — so unlike
// everything above, these two columns (added after providers/requests
// already existed with seed data in them) need an actual imperative check
// against PRAGMA table_info before altering. This is the first real schema
// migration in the app; see BUILD_LOG for why it's still handled inline
// here rather than reaching for a migration tool for one change.
export function runMigrations(db) {
  addColumnIfMissing(db, 'providers', 'owner_user_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing(db, 'requests', 'requester_user_id', 'INTEGER REFERENCES users(id)');
}

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
