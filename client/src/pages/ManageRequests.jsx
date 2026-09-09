import { useEffect, useState } from 'react';
import { fetchMyProviders, fetchProviderRequests, updateRequestStatus } from '../lib/api.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import RequireSignIn from '../components/RequireSignIn.jsx';
import Badge from '../components/Badge.jsx';

const STATUS_TONE = { pending: 'amber', accepted: 'pine', declined: 'outline' };

export default function ManageRequests() {
  usePageTitle('Manage Requests');
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Manage requests</h1>
      <p className="mt-2 text-ink-soft">
        Accepting a request reveals your exact location and contact info to that requester only.
      </p>
      <div className="mt-6">
        <RequireSignIn prompt="Sign in to manage your listing's requests.">
          <ManageRequestsPanel />
        </RequireSignIn>
      </div>
    </div>
  );
}

function ManageRequestsPanel() {
  // Listings come straight from the server now (GET /providers/mine, scoped
  // to the session) instead of a client-side list of ids the browser had to
  // remember — so there's no "this listing no longer exists" state to
  // handle anymore. If it's gone server-side, it's just not in this list.
  const [listings, setListings] = useState(null);
  const [activeListingId, setActiveListingId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchMyProviders().then((data) => {
      setListings(data);
      setActiveListingId(data[0]?.id ?? null);
    });
  }, []);

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
      await updateRequestStatus(requestId, status);
      load();
    } catch (err) {
      setActionError(err.message);
    }
  }

  if (listings === null) {
    return <p className="text-ink-soft">Loading…</p>;
  }

  if (listings.length === 0) {
    return (
      <p className="text-ink-soft">
        You haven't listed a service yet.{' '}
        <a href="/list" className="font-semibold text-navy underline">
          List yourself
        </a>{' '}
        to start receiving requests.
      </p>
    );
  }

  return (
    <div>
      {listings.length > 1 && (
        <select
          value={activeListingId}
          onChange={(e) => setActiveListingId(Number(e.target.value))}
          className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-sm font-medium text-ink focus:border-navy focus:outline-none"
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
