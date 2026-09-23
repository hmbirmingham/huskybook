import { Router } from 'express';
import { db } from '../db/index.js';
import { toPublicProvider, toOwnerProvider } from '../lib/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export const providersRouter = Router();

const CATEGORIES = ['hair', 'nails', 'makeup', 'braids', 'other'];
const TYPES = ['dorm', 'mobile'];

// Browse the directory. Deliberately public-fields-only, and deliberately
// open to anyone signed in or not. This is the one endpoint that must
// never carry exact_location or contact_method.
providersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
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
    const result = await db.execute({
      sql: `SELECT * FROM providers ${where} ORDER BY created_at DESC`,
      args: params,
    });

    res.json(result.rows.map(toPublicProvider));
  })
);

// The signed-in user's own listings, owner view, since these are all
// listings they themselves created. This replaces the old localStorage
// bookkeeping in the client (client/src/lib/identity.js) with the actual
// source of truth: whichever rows this account owns in the database.
providersRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: 'SELECT * FROM providers WHERE owner_user_id = ? ORDER BY created_at DESC',
      args: [req.user.id],
    });
    res.json(result.rows.map(toOwnerProvider));
  })
);

// "List yourself": create a provider listing, owned by the signed-in
// account. Returns the owner view (including the private fields) since the
// person who just submitted this form obviously already knows their own
// room number and contact info.
providersRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
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

    const result = await db.execute({
      sql: `INSERT INTO providers
              (name, category, type, building_zone, exact_location, specialties, price_range, contact_method, available, owner_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        name,
        category,
        type,
        buildingZone,
        exactLocation,
        JSON.stringify(specialties),
        priceRange,
        contactMethod,
        available ? 1 : 0,
        req.user.id,
      ],
    });

    const row = await db.execute({
      sql: 'SELECT * FROM providers WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });
    res.status(201).json(toOwnerProvider(row.rows[0]));
  })
);

// Edit one of your own listings. Ownership is checked against the
// session, same pattern as everywhere else in this file. Never trust a
// provider id alone. Partial update: only fields present in the body are
// changed, so the client can send just what the edit form touched.
providersRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM providers WHERE id = ?',
      args: [req.params.id],
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    const {
      name,
      category,
      type,
      buildingZone,
      exactLocation,
      contactMethod,
      specialties,
      priceRange,
      available,
    } = req.body;

    if (category !== undefined && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (type !== undefined && !TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${TYPES.join(', ')}` });
    }

    // Build the SET clause from only the fields the caller actually sent,
    // so e.g. toggling "available" doesn't require resending every field.
    const fields = {
      name,
      category,
      type,
      building_zone: buildingZone,
      exact_location: exactLocation,
      contact_method: contactMethod,
      specialties: specialties !== undefined ? JSON.stringify(specialties) : undefined,
      price_range: priceRange,
      available: available !== undefined ? (available ? 1 : 0) : undefined,
    };
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await db.execute({
      sql: `UPDATE providers SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
      args: [...entries.map(([, v]) => v), req.params.id],
    });

    const updatedResult = await db.execute({
      sql: 'SELECT * FROM providers WHERE id = ?',
      args: [req.params.id],
    });
    res.json(toOwnerProvider(updatedResult.rows[0]));
  })
);

// Take down one of your own listings. Requests sent to it are removed in
// the same transaction (via db.batch) rather than left dangling, a
// request pointing at a deleted provider_id would break the "join to
// providers" queries elsewhere (e.g. requests.js's REQUEST_WITH_PROVIDER_SQL).
providersRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM providers WHERE id = ?',
      args: [req.params.id],
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    if (existing.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    await db.batch(
      [
        { sql: 'DELETE FROM requests WHERE provider_id = ?', args: [req.params.id] },
        { sql: 'DELETE FROM providers WHERE id = ?', args: [req.params.id] },
      ],
      'write'
    );

    res.json({ ok: true });
  })
);

// Incoming requests for one provider's listing, now actually checks that
// the caller owns it, closing the gap flagged since Phase 1: this used to
// be provider_id in, matching data out, with nothing verifying the two
// were the same account.
providersRouter.get(
  '/:id/requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const providerResult = await db.execute({
      sql: 'SELECT * FROM providers WHERE id = ?',
      args: [req.params.id],
    });
    const provider = providerResult.rows[0];
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    if (provider.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM requests WHERE provider_id = ? ORDER BY created_at DESC',
      args: [req.params.id],
    });

    res.json(
      result.rows.map((r) => ({
        id: r.id,
        requesterName: r.requester_name,
        note: r.note,
        status: r.status,
        createdAt: r.created_at,
      }))
    );
  })
);
