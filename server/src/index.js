import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { providersRouter } from './routes/providers.js';
import { requestsRouter } from './routes/requests.js';
import { authRouter } from './routes/auth.js';
import { attachUser } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/providers', providersRouter);
app.use('/api/requests', requestsRouter);

// In dev, Vite's own server handles the client (proxying /api back to
// here — see client/vite.config.js). In production there's no separate
// Vite server, so this process serves the client's build output itself:
// one Railway service, one URL, rather than standing up a second static
// host. The client is a single-page app, so any non-API path that isn't
// a real file (a client-side route like /verify or /manage) falls back
// to index.html and React Router takes it from there.
if (IS_PRODUCTION) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`HuskyBook API listening on http://localhost:${PORT}`);
  if (IS_PRODUCTION) {
    // Temporary boot-time diagnostic — never logs actual secret values,
    // only presence/prefix, safe for a server log. Added to debug a
    // deployed instance reporting "missing API key" from Resend despite
    // the dashboard showing RESEND_API_KEY as set; remove once resolved.
    console.log('[env check]', {
      RESEND_API_KEY: process.env.RESEND_API_KEY
        ? `set (${process.env.RESEND_API_KEY.slice(0, 5)}..., length ${process.env.RESEND_API_KEY.length})`
        : 'MISSING',
      BASE_URL: process.env.BASE_URL || 'MISSING',
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'MISSING',
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
    });
  }
});
