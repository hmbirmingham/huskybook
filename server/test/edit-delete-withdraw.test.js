// Covers PR #16's edit/delete for listings and withdraw for pending
// requests (server/src/routes/providers.js PATCH/DELETE '/:id',
// server/src/routes/requests.js DELETE '/:id'). These shipped without
// their own test coverage, and the existing suites predate them.
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

test('the owner can partially edit their own listing', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'PATCH', `/api/providers/${listing.json.id}`, {
    cookie: owner.cookie,
    body: { name: 'Updated Name', available: false },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.name, 'Updated Name');
  assert.equal(res.json.available, false);
  // Untouched fields survive the partial update.
  assert.equal(res.json.buildingZone, 'North Campus');
});

test('a non-owner cannot edit someone else\'s listing', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const stranger = await signIn(baseUrl, uniqueEmail('stranger'), 'Stranger');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'PATCH', `/api/providers/${listing.json.id}`, {
    cookie: stranger.cookie,
    body: { name: 'Hijacked' },
  });
  assert.equal(res.status, 403);
});

test('editing a listing rejects an invalid category', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'PATCH', `/api/providers/${listing.json.id}`, {
    cookie: owner.cookie,
    body: { category: 'not-a-real-category' },
  });
  assert.equal(res.status, 400);
});

test('editing a listing with no fields is rejected', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'PATCH', `/api/providers/${listing.json.id}`, {
    cookie: owner.cookie,
    body: {},
  });
  assert.equal(res.status, 400);
});

test('editing a nonexistent listing 404s', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const res = await api(baseUrl, 'PATCH', '/api/providers/999999', {
    cookie: owner.cookie,
    body: { name: 'Ghost' },
  });
  assert.equal(res.status, 404);
});

test('the owner can delete their own listing, and it drops from the public directory', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'DELETE', `/api/providers/${listing.json.id}`, { cookie: owner.cookie });
  assert.equal(res.status, 200);

  const directory = await api(baseUrl, 'GET', '/api/providers');
  assert.ok(!directory.json.some((p) => p.id === listing.json.id));
});

test('deleting a listing also removes requests sent to it', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');
  const listing = await createListing(baseUrl, owner.cookie);
  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });

  await api(baseUrl, 'DELETE', `/api/providers/${listing.json.id}`, { cookie: owner.cookie });

  const mine = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  assert.ok(!mine.json.some((r) => r.id === sent.json.id));
});

test('a non-owner cannot delete someone else\'s listing', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const stranger = await signIn(baseUrl, uniqueEmail('stranger'), 'Stranger');
  const listing = await createListing(baseUrl, owner.cookie);

  const res = await api(baseUrl, 'DELETE', `/api/providers/${listing.json.id}`, { cookie: stranger.cookie });
  assert.equal(res.status, 403);

  const directory = await api(baseUrl, 'GET', '/api/providers');
  assert.ok(directory.json.some((p) => p.id === listing.json.id));
});

test('deleting a nonexistent listing 404s', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const res = await api(baseUrl, 'DELETE', '/api/providers/999999', { cookie: owner.cookie });
  assert.equal(res.status, 404);
});

test('the requester can withdraw their own pending request', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');
  const listing = await createListing(baseUrl, owner.cookie);
  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });

  const res = await api(baseUrl, 'DELETE', `/api/requests/${sent.json.id}`, { cookie: requester.cookie });
  assert.equal(res.status, 200);

  const mine = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  assert.ok(!mine.json.some((r) => r.id === sent.json.id));
});

test('a request already accepted cannot be withdrawn', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');
  const listing = await createListing(baseUrl, owner.cookie);
  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });
  await api(baseUrl, 'PATCH', `/api/requests/${sent.json.id}`, {
    cookie: owner.cookie,
    body: { status: 'accepted' },
  });

  const res = await api(baseUrl, 'DELETE', `/api/requests/${sent.json.id}`, { cookie: requester.cookie });
  assert.equal(res.status, 409);

  const mine = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  assert.equal(mine.json.find((r) => r.id === sent.json.id).status, 'accepted');
});

test('a stranger cannot withdraw someone else\'s request', async () => {
  const owner = await signIn(baseUrl, uniqueEmail('owner'), 'Owner');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');
  const stranger = await signIn(baseUrl, uniqueEmail('stranger'), 'Stranger');
  const listing = await createListing(baseUrl, owner.cookie);
  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });

  const res = await api(baseUrl, 'DELETE', `/api/requests/${sent.json.id}`, { cookie: stranger.cookie });
  assert.equal(res.status, 403);
});

test('withdrawing a nonexistent request 404s', async () => {
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester');
  const res = await api(baseUrl, 'DELETE', '/api/requests/999999', { cookie: requester.cookie });
  assert.equal(res.status, 404);
});

test('edit, delete, and withdraw all 401 with no session', async () => {
  const checks = [
    ['PATCH', '/api/providers/1'],
    ['DELETE', '/api/providers/1'],
    ['DELETE', '/api/requests/1'],
  ];

  for (const [method, path] of checks) {
    const res = await api(baseUrl, method, path, { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should require auth`);
  }
});
