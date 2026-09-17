// Covers the magic-link auth seam itself: domain restriction, single-use
// tokens (the exact property whose StrictMode double-invoke bug is logged
// in BUILD_LOG Phase 6), and the cooldown that must not be distinguishable
// from a normal send in the response shape.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, api, uniqueEmail } from '../spec-helpers.js';

let server, baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestApp());
});

after(async () => {
  await stopTestApp(server);
});

test('rejects a non-@uconn.edu email', async () => {
  const res = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email: 'student@gmail.com' } });
  assert.equal(res.status, 400);
});

test('issues a devLoginUrl for a valid @uconn.edu email outside production', async () => {
  const res = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email: uniqueEmail('valid') } });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.ok(res.json.devLoginUrl);
});

test('a login token can only be used once', async () => {
  const email = uniqueEmail('single-use');
  const link = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email } });
  const token = new URL(link.json.devLoginUrl).searchParams.get('token');

  const first = await fetch(`${baseUrl}/api/auth/verify?token=${token}`);
  assert.equal(first.status, 200);

  const second = await fetch(`${baseUrl}/api/auth/verify?token=${token}`);
  assert.equal(second.status, 400);
});

test('an unknown token is rejected', async () => {
  const res = await fetch(`${baseUrl}/api/auth/verify?token=not-a-real-token`);
  assert.equal(res.status, 400);
});

test('a repeated link request within the cooldown does not reveal a new link', async () => {
  const email = uniqueEmail('cooldown');
  const first = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email } });
  assert.ok(first.json.devLoginUrl);

  const second = await api(baseUrl, 'POST', '/api/auth/request-link', { body: { email } });
  assert.equal(second.status, 200);
  assert.equal(second.json.ok, true);
  assert.equal(second.json.devLoginUrl, undefined);
});

test('GET /api/auth/me reflects no session when no cookie is sent', async () => {
  const res = await api(baseUrl, 'GET', '/api/auth/me');
  assert.equal(res.status, 200);
  assert.equal(res.json.user, null);
});
