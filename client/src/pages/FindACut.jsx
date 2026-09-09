import { useEffect, useState } from 'react';
import { fetchProviders } from '../lib/api.js';
import { CATEGORIES, TYPES } from '../lib/constants.js';
import ProviderCard from '../components/ProviderCard.jsx';
import RequestModal from '../components/RequestModal.jsx';

export default function FindACut() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ category: '', type: '', availableOnly: false });
  const [requesting, setRequesting] = useState(null);
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProviders(filters)
      .then((data) => {
        if (!cancelled) setProviders(data);
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
  }, [filters.category, filters.type, filters.availableOnly]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Find a service</h1>
      <p className="mt-1 text-ink-soft">
        Browse who's around campus right now. Exact room numbers stay hidden until a provider
        accepts your request.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-2 border-ink/20 bg-paper-dark/40 p-4">
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-sm font-medium text-ink focus:border-navy focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-sm font-medium text-ink focus:border-navy focus:outline-none"
        >
          <option value="">Dorm or mobile</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={filters.availableOnly}
            onChange={(e) => setFilters((f) => ({ ...f, availableOnly: e.target.checked }))}
            className="h-4 w-4 accent-pine"
          />
          Available only
        </label>
      </div>

      {confirmation && (
        <p className="mt-4 border-2 border-pine bg-pine/10 px-4 py-3 text-sm font-medium text-pine-dark">
          {confirmation}
        </p>
      )}

      {loading && <p className="mt-8 text-ink-soft">Loading the directory…</p>}
      {error && <p className="mt-8 font-medium text-rust">{error}</p>}
      {!loading && !error && providers.length === 0 && (
        <p className="mt-8 text-ink-soft">Nobody matches those filters yet — try widening them.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} onRequest={setRequesting} />
        ))}
      </div>

      {requesting && (
        <RequestModal
          provider={requesting}
          onClose={() => setRequesting(null)}
          onSubmitted={() => {
            setConfirmation(`Request sent to ${requesting.name} — check "My Requests" for updates.`);
            setRequesting(null);
          }}
        />
      )}
    </div>
  );
}
