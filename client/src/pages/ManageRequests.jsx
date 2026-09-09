import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProviderRequests, updateRequestStatus } from '../lib/api.js';
import { getMyListings } from '../lib/identity.js';
import Badge from '../components/Badge.jsx';

const STATUS_TONE = { pending: 'amber', accepted: 'pine', declined: 'outline' };

export default function ManageRequests() {
  const [listings] = useState(getMyListings());
  const [activeListingId, setActiveListingId] = useState(listings[0]?.id ?? null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!activeListingId) return;
    load();
  }, [activeListingId]);

  function load() {
    setLoading(true);
    setError('');
    fetchProviderRequests(activeListingId)
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function respond(requestId, status) {
    setActionError('');
    try {
      await updateRequestStatus(requestId, status, activeListingId);
      load();
    } catch (err) {
      setActionError(err.message);
    }
  }

  if (listings.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Manage requests</h1>
        <p className="mt-2 text-ink-soft">
          You haven't listed a service on this browser yet.{' '}
          <Link to="/list" className="font-semibold text-navy underline">
            List yourself
          </Link>{' '}
          to start receiving requests.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Manage requests</h1>
      <p className="mt-2 text-ink-soft">
        Accepting a request reveals your exact location and contact info to that requester only.
      </p>

      {listings.length > 1 && (
        <select
          value={activeListingId}
          onChange={(e) => setActiveListingId(Number(e.target.value))}
          className="mt-4 border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-sm font-medium text-ink focus:border-navy focus:outline-none"
        >
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {loading && <p className="mt-6 text-ink-soft">Loading…</p>}
      {error && <p className="mt-6 font-medium text-rust">{error}</p>}
      {actionError && <p className="mt-4 font-medium text-rust">{actionError}</p>}

      {!loading && !error && requests.length === 0 && (
        <p className="mt-6 text-ink-soft">No requests yet.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {requests.map((r) => (
          <article key={r.id} className="border-2 border-ink/20 bg-[#fbf5e6] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-lg font-semibold text-ink">{r.requesterName}</p>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            </div>
            {r.note && <p className="mt-2 text-sm italic text-ink-soft">"{r.note}"</p>}
            {r.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => respond(r.id, 'accepted')}
                  className="border-2 border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respond(r.id, 'declined')}
                  className="border-2 border-ink/30 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink"
                >
                  Decline
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
