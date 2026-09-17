import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendRequestNotification, sendRequestStatusUpdate } from '../lib/mailer.js';
import { asyncHandler } from '../lib/asyncHandler.js';

// Email delivery never blocks or fails a request/response cycle — a flaky
// mail provider shouldn't be able to break the actual feature (submitting
// or accepting a request). Errors are logged, not surfaced to the client.
function notify(promise) {
  promise.catch((err) => console.error('[mailer] notification failed:', err.message));
}

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

async function fetchRequestForRequester(id) {
  const result = await db.execute({
    sql: `${REQUEST_WITH_PROVIDER_SQL} WHERE requests.id = ?`,
    args: [id],
  });
  return result.rows[0];
}

// Submit a request to a provider. Starts pending; the provider has to
// accept before the requester learns anything private about them. The
// requester's identity comes entirely from the session now — requesterName
// is the account's display_name, not a value the client gets to supply,
// which closes the old "type any name" gap.
requestsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { providerId, note = null } = req.body;

    if (!req.user.display_name) {
      return res.status(400).json({ error: 'Set a display name before requesting a service' });
    }
    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required' });
    }

    const providerResult = await db.execute({
      sql: `SELECT providers.name, users.email AS owner_email
            FROM providers
            LEFT JOIN users ON users.id = providers.owner_user_id
            WHERE providers.id = ?`,
      args: [providerId],
    });
    const provider = providerResult.rows[0];
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO requests (provider_id, requester_name, requester_user_id, note) VALUES (?, ?, ?, ?)',
      args: [providerId, req.user.display_name, req.user.id, note],
    });

    const row = await fetchRequestForRequester(Number(result.lastInsertRowid));
    res.status(201).json(serializeForRequester(row));

    // Seed/demo listings have no owner_user_id (see seed.js) and so no email
    // to notify — nothing to send in that case, not an error.
    if (provider.owner_email) {
      notify(sendRequestNotification(provider.owner_email, req.user.display_name, provider.name));
    }
  })
);

// The signed-in user's own sent requests. Filtered by requester_user_id,
// not by a name string a client could supply for anyone — this used to be
// GET /?requesterName=, which meant anyone could read anyone's requests by
// typing their name. This is the one place the private provider fields
// (exact_location, contact_method) are ever sent to a requester, and only
// for requests that are specifically `accepted` — that filtering happens
// in the SQL below, not as an afterthought in the response shape.
requestsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await db.execute({
      sql: `${REQUEST_WITH_PROVIDER_SQL} WHERE requests.requester_user_id = ? ORDER BY requests.created_at DESC`,
      args: [req.user.id],
    });

    res.json(result.rows.map(serializeForRequester));
  })
);

// Accept or decline. This is the moment the location unlocks — it's a side
// effect of the status flip, not a separate action, so there's no window
// where a request is "accepted" but the location hasn't caught up.
// Ownership is now checked against the session, not a client-supplied
// providerId — the old version trusted whatever id the client sent along.
requestsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }

    const existingResult = await db.execute({
      sql: 'SELECT * FROM requests WHERE id = ?',
      args: [req.params.id],
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const providerResult = await db.execute({
      sql: 'SELECT name, owner_user_id FROM providers WHERE id = ?',
      args: [existing.provider_id],
    });
    const provider = providerResult.rows[0];
    if (!provider || provider.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own the listing this request was sent to' });
    }

    await db.execute({ sql: 'UPDATE requests SET status = ? WHERE id = ?', args: [status, req.params.id] });
    const updatedResult = await db.execute({ sql: 'SELECT * FROM requests WHERE id = ?', args: [req.params.id] });
    const updated = updatedResult.rows[0];
    res.json({
      id: updated.id,
      providerId: updated.provider_id,
      requesterName: updated.requester_name,
      note: updated.note,
      status: updated.status,
      createdAt: updated.created_at,
    });

    let requesterEmail = null;
    if (updated.requester_user_id) {
      const requesterResult = await db.execute({
        sql: 'SELECT email FROM users WHERE id = ?',
        args: [updated.requester_user_id],
      });
      requesterEmail = requesterResult.rows[0]?.email ?? null;
    }
    if (requesterEmail) {
      notify(sendRequestStatusUpdate(requesterEmail, status, provider.name));
    }
  })
);

// Withdraw a request you sent. Restricted to your own requests, and only
// while still pending — once a provider has acted on it (accepted/
// declined), that's now their record too, so it's left alone rather than
// disappearing out from under them.
requestsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM requests WHERE id = ?',
      args: [req.params.id],
    });
    const existing = existingResult.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (existing.requester_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You did not send this request' });
    }
    if (existing.status !== 'pending') {
      return res.status(409).json({ error: 'Only a pending request can be withdrawn' });
    }

    await db.execute({ sql: 'DELETE FROM requests WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  })
);

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
