import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Named test-helpers.js and kept out of test/ on purpose: node --test's
// default discovery treats every .js file inside a directory named `test`
// as a test file to run, which would mean this (zero test() calls) either
// gets flagged as an empty suite or silently skipped depending on version.
// Living beside it, one level up, keeps it a plain importable module.

// Each call gets its own throwaway sqlite file via DATABASE_URL (see
// server/src/db/index.js) so tests never touch the real dev database and
// don't interfere with each other — node --test runs each *.test.js file
// in its own process by default, so setting this per-file env var here is
// safe even though db/index.js's client is a module-level singleton.
export async function startTestApp() {
  const dbFile = path.join(os.tmpdir(), `huskybook-test-${crypto.randomUUID()}.sqlite`);
  process.env.DATABASE_URL = `file:${dbFile}`;
  process.env.NODE_ENV = 'test';

  // Dynamic import, not a static one: it must run after the env vars above
  // are set, since db/index.js reads them at module-load time.
  const { app } = await import('./src/app.js');
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export function stopTestApp(server) {
  return new Promise((resolve) => server.close(resolve));
}

export function uniqueEmail(prefix) {
  return `${prefix}-${crypto.randomUUID()}@uconn.edu`;
}

// Thin JSON fetch wrapper — every route in this app speaks JSON in and out,
// so this is the one shape every test needs instead of repeating
// fetch/headers/JSON.parse boilerplate at every call site.
export async function api(baseUrl, method, urlPath, { body, cookie } = {}) {
  const canHaveBody = !['GET', 'HEAD'].includes(method);
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: canHaveBody && body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}

// Drives the actual magic-link flow (request-link -> devLoginUrl -> verify)
// rather than inserting a session row directly — the point of these tests
// is to exercise the real auth seam, not a shortcut around it.
export async function signIn(baseUrl, email, displayName) {
  const link = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email } });
  const token = new URL(link.json.devLoginUrl).searchParams.get('token');

  const verifyRes = await fetch(`${baseUrl}/api/auth/verify?token=${token}`);
  const cookie = verifyRes.headers.get('set-cookie').split(';')[0];
  let { user } = await verifyRes.json();

  if (displayName) {
    const updated = await api(baseUrl, 'PATCH', '/api/auth/me', { body: { displayName }, cookie });
    user = updated.json.user;
  }

  return { cookie, user };
}

export function createListing(baseUrl, cookie, overrides = {}) {
  return api(baseUrl, 'POST', '/api/providers', {
    cookie,
    body: {
      name: 'Test Listing',
      category: 'hair',
      type: 'dorm',
      buildingZone: 'North Campus',
      exactLocation: 'Room 101',
      contactMethod: '@test.handle',
      ...overrides,
    },
  });
}
