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

// Split from index.js's app.listen() so the app itself can be imported
// without binding a port — the test suite does exactly this, driving real
// HTTP requests against an ephemeral port instead of a fixed one.
export const app = express();

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
