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
// recently. The caller returns the same {ok:true} either way, so a client
// can't use response timing/shape to tell "you just spammed this" apart
// from "link sent."
export async function createLoginToken(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const recent = await db.execute({
    sql: `SELECT id FROM login_tokens
          WHERE email = ? AND used = 0 AND created_at > ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [normalizedEmail, isoIn(-LOGIN_TOKEN_COOLDOWN_MS)],
  });
  if (recent.rows.length > 0) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  await db.execute({
    sql: 'INSERT INTO login_tokens (email, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [normalizedEmail, hashToken(rawToken), isoIn(LOGIN_TOKEN_TTL_MS)],
  });
  return rawToken;
}

// Marks the token used and returns the user it belongs to (creating the
// user row on first sign-in), or null if the token is unknown, already
// used, or expired. Only the hash is ever looked up; the raw token exists
// only in the URL that got emailed.
export async function consumeLoginToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const found = await db.execute({
    sql: 'SELECT * FROM login_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?',
    args: [tokenHash, new Date().toISOString()],
  });
  const row = found.rows[0];
  if (!row) return null;

  await db.execute({ sql: 'UPDATE login_tokens SET used = 1 WHERE id = ?', args: [row.id] });
  await db.execute({
    sql: 'INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING',
    args: [row.email],
  });
  const user = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [row.email] });
  return user.rows[0];
}

export async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    args: [sessionId, userId, isoIn(SESSION_TTL_MS)],
  });
  return sessionId;
}

export async function getUserBySession(sessionId) {
  if (!sessionId) return null;
  const result = await db.execute({
    sql: `SELECT users.* FROM sessions
          JOIN users ON users.id = sessions.user_id
          WHERE sessions.id = ? AND sessions.expires_at > ?`,
    args: [sessionId, new Date().toISOString()],
  });
  return result.rows[0] || null;
}

export async function destroySession(sessionId) {
  await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] });
}

export async function setDisplayName(userId, displayName) {
  await db.execute({
    sql: 'UPDATE users SET display_name = ? WHERE id = ?',
    args: [displayName.trim(), userId],
  });
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
  return result.rows[0];
}

export function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name };
}
