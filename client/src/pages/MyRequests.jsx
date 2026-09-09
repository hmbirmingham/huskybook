import { useEffect, useState } from 'react';
import { fetchMyRequests } from '../lib/api.js';
import { categoryLabel } from '../lib/constants.js';
import Badge from '../components/Badge.jsx';
import { getStoredName, setStoredName } from '../lib/identity.js';
import { usePageTitle } from '../lib/usePageTitle.js';

const STATUS_TONE = { pending: 'amber', accepted: 'pine', declined: 'outline' };

export default function MyRequests() {
  usePageTitle('My Requests');
  const [name, setName] = useState(getStoredName());
  const [nameInput, setNameInput] = useState(getStoredName());
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setLoading(true);
    fetchMyRequests(name)
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
  }, [name]);

  function handleViewRequests(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setStoredName(nameInput);
    setName(nameInput.trim());
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">My requests</h1>
      <p className="mt-2 text-ink-soft">
        Once a provider accepts, their exact location and contact info show up here.
      </p>

      <form onSubmit={handleViewRequests} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Viewing requests sent as
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="The name you used when requesting"
            className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-base text-ink focus:border-navy focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="border-2 border-ink bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
        >
          View requests
        </button>
      </form>

      {loading && <p className="mt-6 text-ink-soft">Loading…</p>}
      {error && <p className="mt-6 font-medium text-rust">{error}</p>}

      {name && !loading && requests.length === 0 && !error && (
        <p className="mt-6 text-ink-soft">
          No requests sent as "{name}" yet — head to Find a Service to send one.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
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
    </div>
  );
}
