import { SESSION_COOKIE, getUserBySession } from '../lib/auth.js';

// Hand-rolled instead of adding cookie-parser for one cookie — Express's
// res.cookie() already works with no extra dependency, this is just the
// read side.
function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

// Runs on every request and attaches req.user (or null) — cheap enough that
// routes never have to remember to opt in before reading it.
export function attachUser(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.sessionId = cookies[SESSION_COOKIE] || null;
  req.user = getUserBySession(req.sessionId);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}
