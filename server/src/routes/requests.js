import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export const requestsRouter = Router();

// Shared by the create and list endpoints so the "only reveal the private
// provider fields once accepted" rule lives in one query, not two.
const REQUEST_WITH_PROVIDER_SQL = `
  SELECT
    requests.*,
    providers.name AS provider_name,
    providers.category AS provider_category,
    providers.building_zone AS provider_building_zone,
    providers.price_range AS provider_price_range,
    CASE WHEN requests.status = 'accepted' THEN providers.exact_location ELSE NULL END AS provider_exact_location,
    CASE WHEN requests.status = 'accepted' THEN providers.contact_method ELSE NULL END AS provider_contact_method
  FROM requests
  JOIN providers ON providers.id = requests.provider_id
`;

function fetchRequestForRequester(id) {
  return db.prepare(`${REQUEST_WITH_PROVIDER_SQL} WHERE requests.id = ?`).get(id);
}

// Submit a request to a provider. Starts pending; the provider has to
// accept before the requester learns anything private about them. The
// requester's identity comes entirely from the session now — requesterName
// is the account's display_name, not a value the client gets to supply,
// which closes the old "type any name" gap.
requestsRouter.post('/', requireAuth, (req, res) => {
  const { providerId, note = null } = req.body;

  if (!req.user.display_name) {
    return res.status(400).json({ error: 'Set a display name before requesting a service' });
  }
  if (!providerId) {
    return res.status(400).json({ error: 'providerId is required' });
  }

  const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(providerId);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const result = db
    .prepare(
      'INSERT INTO requests (provider_id, requester_name, requester_user_id, note) VALUES (?, ?, ?, ?)'
    )
    .run(providerId, req.user.display_name, req.user.id, note);

  const row = fetchRequestForRequester(result.lastInsertRowid);
  res.status(201).json(serializeForRequester(row));
});

// The signed-in user's own sent requests. Filtered by requester_user_id,
// not by a name string a client could supply for anyone — this used to be
// GET /?requesterName=, which meant anyone could read anyone's requests by
// typing their name. This is the one place the private provider fields
// (exact_location, contact_method) are ever sent to a requester, and only
// for requests that are specifically `accepted` — that filtering happens
// in the SQL below, not as an afterthought in the response shape.
requestsRouter.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`${REQUEST_WITH_PROVIDER_SQL} WHERE requests.requester_user_id = ? ORDER BY requests.created_at DESC`)
    .all(req.user.id);

  res.json(rows.map(serializeForRequester));
});

// Accept or decline. This is the moment the location unlocks — it's a side
// effect of the status flip, not a separate action, so there's no window
// where a request is "accepted" but the location hasn't caught up.
// Ownership is now checked against the session, not a client-supplied
// providerId — the old version trusted whatever id the client sent along.
requestsRouter.patch('/:id', requireAuth, (req, res) => {
  const { status } = req.body;

  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
  }

  const existing = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const provider = db.prepare('SELECT owner_user_id FROM providers WHERE id = ?').get(existing.provider_id);
  if (!provider || provider.owner_user_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not own the listing this request was sent to' });
  }

  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  res.json({
    id: updated.id,
    providerId: updated.provider_id,
    requesterName: updated.requester_name,
    note: updated.note,
    status: updated.status,
    createdAt: updated.created_at,
  });
});

function serializeForRequester(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    provider: {
      name: row.provider_name,
      category: row.provider_category,
      buildingZone: row.provider_building_zone,
      priceRange: row.provider_price_range,
      exactLocation: row.provider_exact_location ?? null,
      contactMethod: row.provider_contact_method ?? null,
    },
  };
}
