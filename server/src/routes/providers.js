import { Router } from 'express';
import { db } from '../db/index.js';
import { toPublicProvider, toOwnerProvider } from '../lib/serialize.js';
import { requireAuth } from '../middleware/auth.js';

export const providersRouter = Router();

const CATEGORIES = ['hair', 'nails', 'makeup', 'braids', 'other'];
const TYPES = ['dorm', 'mobile'];

// Browse the directory. Deliberately public-fields-only, and deliberately
// open to anyone signed in or not — this is the one endpoint that must
// never carry exact_location or contact_method.
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

// The signed-in user's own listings — owner view, since these are all
// listings they themselves created. This replaces the old localStorage
// bookkeeping in the client (client/src/lib/identity.js) with the actual
// source of truth: whichever rows this account owns in the database.
providersRouter.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM providers WHERE owner_user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(rows.map(toOwnerProvider));
});

// "List yourself" — create a provider listing, owned by the signed-in
// account. Returns the owner view (including the private fields) since the
// person who just submitted this form obviously already knows their own
// room number and contact info.
providersRouter.post('/', requireAuth, (req, res) => {
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
        (name, category, type, building_zone, exact_location, specialties, price_range, contact_method, available, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      available ? 1 : 0,
      req.user.id
    );

  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toOwnerProvider(row));
});

// Incoming requests for one provider's listing — now actually checks that
// the caller owns it, closing the gap flagged since Phase 1: this used to
// be provider_id in, matching data out, with nothing verifying the two
// were the same account.
providersRouter.get('/:id/requests', requireAuth, (req, res) => {
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  if (provider.owner_user_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not own this listing' });
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
