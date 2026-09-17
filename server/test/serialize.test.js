import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicProvider, toOwnerProvider } from '../src/lib/serialize.js';

const row = {
  id: 1,
  name: 'Marcus Fades',
  category: 'hair',
  type: 'dorm',
  building_zone: 'Buckley',
  exact_location: 'Room 214',
  specialties: '["fades","tapers"]',
  price_range: '$15-25',
  contact_method: '@marcus.cuts',
  available: 1,
  verified: 0,
};

test('toPublicProvider never includes exact_location or contact_method', () => {
  const pub = toPublicProvider(row);
  assert.equal(pub.exactLocation, undefined);
  assert.equal(pub.contactMethod, undefined);
  assert.deepEqual(pub.specialties, ['fades', 'tapers']);
});

test('the public serialization has no trace of the private values as strings', () => {
  // Belt-and-suspenders against a future field rename slipping a private
  // value through under a different key name.
  const json = JSON.stringify(toPublicProvider(row));
  assert.ok(!json.includes('Room 214'));
  assert.ok(!json.includes('marcus.cuts'));
});

test('toOwnerProvider includes the private fields verbatim, plus everything public', () => {
  const owner = toOwnerProvider(row);
  assert.equal(owner.exactLocation, 'Room 214');
  assert.equal(owner.contactMethod, '@marcus.cuts');
  assert.equal(owner.name, 'Marcus Fades');
});
