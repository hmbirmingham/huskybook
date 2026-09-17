// Covers the one rule this whole app is organized around: exact_location
// and contact_method never reach anyone but the listing's own owner until
// a specific request against it has been accepted. Flagged twice in
// BUILD_LOG as logic that deserved regression tests instead of repeated
// manual curl/browser checks — this is that coverage.
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

test('a public directory listing never carries the private fields', async () => {
  const provider = await signIn(baseUrl, uniqueEmail('provider'), 'Provider One');
  const created = await createListing(baseUrl, provider.cookie, {
    exactLocation: 'Secret Room 999',
    contactMethod: '@should-not-leak',
  });
  assert.equal(created.status, 201);

  const list = await api(baseUrl, 'GET', '/api/providers');
  const found = list.json.find((p) => p.id === created.json.id);
  assert.ok(found, 'created listing should appear on the public directory');
  assert.equal(found.exactLocation, undefined);
  assert.equal(found.contactMethod, undefined);
  assert.ok(!JSON.stringify(list.json).includes('Secret Room 999'));
});

test('a pending request hides the location; accepting it unlocks the location for that requester only', async () => {
  const provider = await signIn(baseUrl, uniqueEmail('provider'), 'Provider Two');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester One');
  const bystander = await signIn(baseUrl, uniqueEmail('bystander'), 'Bystander');

  const listing = await createListing(baseUrl, provider.cookie, {
    exactLocation: 'Suite 4B',
    contactMethod: 'text 555-0100',
  });

  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.json.status, 'pending');
  assert.equal(sent.json.provider.exactLocation, null);
  assert.equal(sent.json.provider.contactMethod, null);

  const mineBefore = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  const pendingEntry = mineBefore.json.find((r) => r.id === sent.json.id);
  assert.equal(pendingEntry.provider.exactLocation, null);

  const accept = await api(baseUrl, 'PATCH', `/api/requests/${sent.json.id}`, {
    cookie: provider.cookie,
    body: { status: 'accepted' },
  });
  assert.equal(accept.status, 200);
  assert.equal(accept.json.status, 'accepted');

  const mineAfter = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  const unlocked = mineAfter.json.find((r) => r.id === sent.json.id);
  assert.equal(unlocked.provider.exactLocation, 'Suite 4B');
  assert.equal(unlocked.provider.contactMethod, 'text 555-0100');

  // A second, unrelated account never had a request accepted against this
  // listing — it should never see the location no matter what happened to
  // someone else's request.
  const mineForBystander = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: bystander.cookie });
  assert.equal(mineForBystander.json.length, 0);
});

test('a declined request keeps the location hidden', async () => {
  const provider = await signIn(baseUrl, uniqueEmail('provider'), 'Provider Three');
  const requester = await signIn(baseUrl, uniqueEmail('requester'), 'Requester Two');

  const listing = await createListing(baseUrl, provider.cookie, {
    exactLocation: 'Room 42',
    contactMethod: '@decline-test',
  });

  const sent = await api(baseUrl, 'POST', '/api/requests', {
    cookie: requester.cookie,
    body: { providerId: listing.json.id },
  });

  const decline = await api(baseUrl, 'PATCH', `/api/requests/${sent.json.id}`, {
    cookie: provider.cookie,
    body: { status: 'declined' },
  });
  assert.equal(decline.status, 200);
  assert.equal(decline.json.status, 'declined');

  const mine = await api(baseUrl, 'GET', '/api/requests/mine', { cookie: requester.cookie });
  const declined = mine.json.find((r) => r.id === sent.json.id);
  assert.equal(declined.provider.exactLocation, null);
  assert.equal(declined.provider.contactMethod, null);
});

test('a freshly-submitted listing echoes its own private fields back to its own owner (not a leak)', async () => {
  const provider = await signIn(baseUrl, uniqueEmail('provider'), 'Provider Four');
  const created = await createListing(baseUrl, provider.cookie, {
    exactLocation: 'Room 7',
    contactMethod: '@own-listing',
  });
  assert.equal(created.json.exactLocation, 'Room 7');
  assert.equal(created.json.contactMethod, '@own-listing');
});
