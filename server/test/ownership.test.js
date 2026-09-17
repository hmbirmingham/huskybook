// Covers the other rule BUILD_LOG flags as a real risk: only the account
// that owns a listing can see its incoming requests or act on them, and
// every route that assumes a signed-in user actually requires one.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, api, signIn, createListing, uniqueEmail } from '../spec-helpers.js';

let server, baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestApp());
});

after(async () => {
  await stopTestApp(server);
});

test('a non-owner cannot view another listing\'s incoming requests', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const stranger = await signIn(baseUrl, uniqueEmail('stranger'), 'Stranger');

  const listing = await createListing(baseUrl, owner.cookie);
  const res = await api(baseUrl, 'GET', `/api/providers/${listing.json.id}/requests`, { cookie: stranger.cookie });
  assert.equal(res.status, 403);
});

test('the actual owner can view their own listing\'s incoming requests', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner Two');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');

  const listing = await createListing(baseUrl, owner.cookie);
  await api(baseUrl, 'POST', '/api/requests', { cookie: requester.cookie, body: { providerId: listing.json.id } });

  const res = await api(baseUrl, 'GET', `/api/providers/${listing.json.id}/requests`, { cookie: owner.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.json.length, 1);
});

test('a non-owner cannot accept or decline a request sent to someone else\'s listing', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner Three');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester Three');
  const stranger = await signIn(baseUrl, uniqueEmail('stranger'), 'Stranger Two');

  const listing = await createListing(baseUrl, owner.cookie);
  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });

  const res = await api(baseUrl, 'PATCH', `/api/requests/${sent.json.id}`, {
    cookie: stranger.cookie,
    body: { status: 'accepted' },
  });
  assert.equal(res.status, 403);

  // Confirm the stranger's rejected attempt didn't change anything.
  const mine = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  assert.equal(mine.json.find((r) => r.id === sent.json.id).status, 'pending');
});

test('every route that requires a session 401s with no cookie at all', async () => {
  const checks = [
    ['GET', '/api/providers/mine'],
    ['POST', '/api/providers'],
    ['POST', '/api/requests'],
    ['GET', '/api/requests/mine'],
    ['PATCH', '/api/requests/1'],
    ['PATCH', '/api/auth/me'],
  ];

  for (const [method, path] of checks) {
    const res = await api(baseUrl, method, path, { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should require auth`);
  }
});

test('GET /api/providers stays public with no session', async () => {
  const res = await api(baseUrl, 'GET', '/api/providers');
  assert.equal(res.status, 200);
});
