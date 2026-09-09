import { useEffect, useState } from 'react';
import { fetchMyRequests } from '../lib/api.js';
import { categoryLabel } from '../lib/constants.js';
import Badge from '../components/Badge.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';
import { useAuth } from '../lib/AuthContext.jsx';
import RequireSignIn from '../components/RequireSignIn.jsx';

const STATUS_TONE = { pending: 'amber', accepted: 'pine', declined: 'outline' };

export default function MyRequests() {
  usePageTitle('My Requests');
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">My requests</h1>
      <p className="mt-2 text-ink-soft">
        Once a provider accepts, their exact location and contact info show up here.
      </p>
      <div className="mt-6">
        <RequireSignIn prompt="Sign in to see the requests you've sent.">
          <MyRequestsList />
        </RequireSignIn>
      </div>
    </div>
  );
}

function MyRequestsList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchMyRequests()
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-ink-soft">Loading…</p>;
  if (error) return <p className="font-medium text-rust">{error}</p>;
  if (requests.length === 0) {
    return (
      <p className="text-ink-soft">
        No requests sent as {user.displayName} yet — head to Find a Service to send one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((r) => (
        <article key={r.id} className="border-2 border-ink/20 bg-[#fbf5e6] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{r.provider.name}</p>
              <p className="text-sm text-ink-soft">
                {categoryLabel(r.provider.category)} · {r.provider.buildingZone}
              </p>
            </div>
            <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
          </div>

          {r.note && <p className="mt-2 text-sm italic text-ink-soft">"{r.note}"</p>}

          {r.status === 'accepted' && (
            <div className="mt-3 border-t border-dashed border-ink/25 pt-3 text-sm">
              <p>
                <span className="font-semibold text-navy">Location:</span> {r.provider.exactLocation}
              </p>
              <p>
                <span className="font-semibold text-navy">Contact:</span> {r.provider.contactMethod}
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
