// Wipes and repopulates the two tables with sample data so the app has
// something to look at on first run. Safe to re-run any time — it's a
// reset, not a migration.
//
// Seeded providers are intentionally unclaimed (owner_user_id stays NULL,
// since no real account created them) — they're there to make the
// directory look populated, not to be managed. Sign in and list yourself
// fresh to test the provider-side flows (Manage Requests, etc.) against a
// listing you actually own.
import { db } from './db/index.js';

db.exec('DELETE FROM requests');
db.exec('DELETE FROM providers');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('requests', 'providers')");

const insertProvider = db.prepare(`
  INSERT INTO providers
    (name, category, type, building_zone, exact_location, specialties, price_range, contact_method, available, verified)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const providers = [
  ['Marcus T.', 'hair', 'dorm', 'Buckley Hall', 'Room 214', ['fades', 'line-ups', 'beard trims'], '$15-25', '@marcuscuts on Instagram', 1, 1],
  ['Priya S.', 'nails', 'dorm', 'Shippee Hall', 'Room 118', ['gel-x', 'nail art', 'acrylics'], '$25-45', 'text (860) 555-0134', 1, 0],
  ['Jordan K.', 'hair', 'mobile', 'North Campus', '—', ['tapers', 'braids', 'kids cuts'], '$20-30', '@jordankutz', 1, 1],
  ['Ava R.', 'makeup', 'dorm', 'Towers', 'Room 305B', ['soft glam', 'editorial', 'bridal trial'], '$40-80', 'text (860) 555-0198', 0, 0],
  ['Deja W.', 'braids', 'mobile', 'South Campus', '—', ['knotless braids', 'cornrows', 'twists'], '$60-120', '@braidsbydeja', 1, 1],
  ['Sam L.', 'hair', 'dorm', 'Alumni Quad', 'Room 402', ['buzz cuts', 'skin fades'], '$10-20', 'text (860) 555-0177', 1, 0],
  ['Nia C.', 'nails', 'mobile', 'Off-campus (Storrs Center)', '—', ['dip powder', 'nail repair'], '$20-40', '@niasnails', 1, 0],
];

const insertedIds = providers.map(([name, category, type, buildingZone, exactLocation, specialties, priceRange, contactMethod, available, verified]) =>
  insertProvider.run(name, category, type, buildingZone, exactLocation, JSON.stringify(specialties), priceRange, contactMethod, available, verified)
    .lastInsertRowid
);

const insertRequest = db.prepare(`
  INSERT INTO requests (provider_id, requester_name, note, status)
  VALUES (?, ?, ?, ?)
`);

insertRequest.run(insertedIds[0], 'Chris P.', 'Looking for a mid fade, free Thursday afternoon?', 'pending');
insertRequest.run(insertedIds[0], 'Taylor M.', 'Can you do a skin fade + line-up this weekend?', 'accepted');
insertRequest.run(insertedIds[1], 'Riley B.', 'Interested in gel-x, any color, this Saturday', 'declined');

console.log(`Seeded ${providers.length} providers and 3 sample requests.`);
