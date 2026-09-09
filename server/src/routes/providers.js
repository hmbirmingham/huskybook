import { Router } from 'express';
import { db } from '../db/index.js';
import { toPublicProvider, toOwnerProvider } from '../lib/serialize.js';

export const providersRouter = Router();

const CATEGORIES = ['hair', 'nails', 'makeup', 'braids', 'other'];
const TYPES = ['dorm', 'mobile'];

// Browse the directory. Deliberately public-fields-only — this is the one
// endpoint anyone can hit with no name/identity at all, so it's the one
// that must never carry exact_location or contact_method.
providersRouter.get('/', (req, res) => {
  const { category, type, available } = req.query;

  const clauses = [];
  const params = [];

  if (category) {
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    clauses.push('category = ?');
    params.push(category);
  }
  if (type) {
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${TYPES.join(', ')}` });
    }
    clauses.push('type = ?');
    params.push(type);
  }
  if (available === 'true') {
    clauses.push('available = 1');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM providers ${where} ORDER BY created_at DESC`).all(...params);

  res.json(rows.map(toPublicProvider));
});

// "List yourself" — create a provider listing. Returns the owner view
// (including the private fields) since the person who just submitted this
// form obviously already knows their own room number and contact info.
// The client is expected to hang on to this id locally (see
// client/src/lib/identity.js) since there's no login to recover it later.
providersRouter.post('/', (req, res) => {
  const {
    name,
    category,
    type,
    buildingZone,
    exactLocation,
    contactMethod,
    specialties = [],
    priceRange = null,
    available = true,
  } = req.body;

  if (!name || !category || !type || !buildingZone || !exactLocation || !contactMethod) {
    return res.status(400).json({
      error: 'name, category, type, buildingZone, exactLocation, and contactMethod are required',
    });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${TYPES.join(', ')}` });
  }

  const result = db
    .prepare(
      `INSERT INTO providers
        (name, category, type, building_zone, exact_location, specialties, price_range, contact_method, available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      category,
      type,
      buildingZone,
      exactLocation,
      JSON.stringify(specialties),
      priceRange,
      contactMethod,
      available ? 1 : 0
    );

  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toOwnerProvider(row));
});

// Incoming requests for one provider's listing. There's no auth to check
// that the caller actually owns this provider_id — see README's Identity
// section and BUILD_LOG for why that's a known, deliberate gap for now.
providersRouter.get('/:id/requests', (req, res) => {
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const rows = db
    .prepare('SELECT * FROM requests WHERE provider_id = ? ORDER BY created_at DESC')
    .all(req.params.id);

  res.json(
    rows.map((r) => ({
      id: r.id,
      requesterName: r.requester_name,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
    }))
  );
});
