import { Router } from 'express';
import { db } from '../db/index.js';

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
// accept before the requester learns anything private about them.
requestsRouter.post('/', (req, res) => {
  const { providerId, requesterName, note = null } = req.body;

  if (!providerId || !requesterName) {
    return res.status(400).json({ error: 'providerId and requesterName are required' });
  }

  const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(providerId);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const result = db
    .prepare('INSERT INTO requests (provider_id, requester_name, note) VALUES (?, ?, ?)')
    .run(providerId, requesterName, note);

  const row = fetchRequestForRequester(result.lastInsertRowid);
  res.status(201).json(serializeForRequester(row));
});

// A requester's own sent requests. This is the one place the private
// provider fields (exact_location, contact_method) are ever sent to a
// requester — and only for requests that are specifically `accepted`.
// A pending or declined request never carries them, even though the
// provider row obviously has the data — that filtering happens in the SQL
// below, not as an afterthought in the response shape.
requestsRouter.get('/', (req, res) => {
  const { requesterName } = req.query;
  if (!requesterName) {
    return res.status(400).json({ error: 'requesterName query param is required' });
  }

  const rows = db
    .prepare(`${REQUEST_WITH_PROVIDER_SQL} WHERE requests.requester_name = ? ORDER BY requests.created_at DESC`)
    .all(requesterName);

  res.json(rows.map(serializeForRequester));
});

// Accept or decline. This is the moment the location unlocks — it's a
// side effect of the status flip, not a separate action, so there's no
// window where a request is "accepted" but the location hasn't caught up.
requestsRouter.patch('/:id', (req, res) => {
  const { status, providerId } = req.body;

  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
  }

  const existing = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Request not found' });
  }
  // Best-effort ownership check — not real auth (see README), but enough
  // to stop a provider from accidentally acting on someone else's request.
  if (providerId && Number(providerId) !== existing.provider_id) {
    return res.status(403).json({ error: 'providerId does not match this request\'s provider' });
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
