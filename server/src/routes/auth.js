import { Router } from 'express';
import {
  isUconnEmail,
  createLoginToken,
  consumeLoginToken,
  createSession,
  destroySession,
  setDisplayName,
  publicUser,
  SESSION_COOKIE,
} from '../lib/auth.js';
import { sendMagicLinkEmail } from '../lib/mailer.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const authRouter = Router();

// BASE_URL is the app's own public origin — in production this is the one
// deployed URL serving both the API and the built client (see index.js);
// in dev it's Vite's dev server, which proxies /api back to this process.
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const IS_DEV = process.env.NODE_ENV !== 'production';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: !IS_DEV,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

authRouter.post(
  '/request-link',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!isUconnEmail(email)) {
      return res.status(400).json({ error: 'Only @uconn.edu email addresses can sign in.' });
    }

    const rawToken = await createLoginToken(email);
    const response = { ok: true };

    if (rawToken) {
      const url = `${BASE_URL}/verify?token=${rawToken}`;
      await sendMagicLinkEmail(email.trim().toLowerCase(), url);
      // Dev convenience only. A real deployment must never hand the sign-in
      // link back in the API response — that defeats the entire point of a
      // magic link, which is that only the inbox owner can see it.
      if (IS_DEV) response.devLoginUrl = url;
    }
    // Same {ok:true} shape whether a token was actually issued or the request
    // hit the per-email cooldown — nothing in the response should let a
    // caller distinguish "spammed" from "sent."

    res.json(response);
  })
);

authRouter.get(
  '/verify',
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing token' });
    }

    const user = await consumeLoginToken(token);
    if (!user) {
      return res.status(400).json({ error: 'This link is invalid or has expired.' });
    }

    const sessionId = await createSession(user.id);
    res.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
    res.json({ user: publicUser(user) });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionId) await destroySession(req.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  })
);

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'displayName is required' });
    }
    const updated = await setDisplayName(req.user.id, displayName);
    res.json({ user: publicUser(updated) });
  })
);
