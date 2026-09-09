import crypto from 'node:crypto';
import { db } from '../db/index.js';

export const SESSION_COOKIE = 'hb_session';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_TOKEN_COOLDOWN_MS = 60 * 1000; // one outstanding link per email per minute

const UCONN_EMAIL_DOMAIN = '@uconn.edu';

export function isUconnEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(UCONN_EMAIL_DOMAIN);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function isoIn(ms) {
  return new Date(Date.now() + ms).toISOString();
}

// Returns null (not an error) when a still-valid link was already issued
// recently — the caller returns the same {ok:true} either way, so a client
// can't use response timing/shape to tell "you just spammed this" apart
// from "link sent."
export function createLoginToken(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const recent = db
    .prepare(
      `SELECT id FROM login_tokens
       WHERE email = ? AND used = 0 AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(normalizedEmail, isoIn(-LOGIN_TOKEN_COOLDOWN_MS));
  if (recent) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO login_tokens (email, token_hash, expires_at) VALUES (?, ?, ?)').run(
    normalizedEmail,
    hashToken(rawToken),
    isoIn(LOGIN_TOKEN_TTL_MS)
  );
  return rawToken;
}

// Marks the token used and returns the user it belongs to (creating the
// user row on first sign-in) — or null if the token is unknown, already
// used, or expired. Only the hash is ever looked up; the raw token exists
// only in the URL that got emailed.
export function consumeLoginToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare('SELECT * FROM login_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?')
    .get(tokenHash, new Date().toISOString());
  if (!row) return null;

  db.prepare('UPDATE login_tokens SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING').run(row.email);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(row.email);
}

export function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    sessionId,
    userId,
    isoIn(SESSION_TTL_MS)
  );
  return sessionId;
}

export function getUserBySession(sessionId) {
  if (!sessionId) return null;
  return (
    db
      .prepare(
        `SELECT users.* FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.id = ? AND sessions.expires_at > ?`
      )
      .get(sessionId, new Date().toISOString()) || null
  );
}

export function destroySession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function setDisplayName(userId, displayName) {
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name };
}
