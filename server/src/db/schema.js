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
`;
