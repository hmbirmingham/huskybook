import { useEffect, useState } from 'react';
import { fetchMyProviders, updateProvider, deleteProvider } from '../lib/api.js';
import { CATEGORIES, TYPES, categoryLabel, typeLabel } from '../lib/constants.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import RequireSignIn from '../components/RequireSignIn.jsx';
import Badge from '../components/Badge.jsx';

const inputClasses =
  'border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-base text-ink focus:border-navy focus:outline-none';
const labelClasses = 'flex flex-col gap-1 text-sm font-medium text-ink';
const hintClasses = 'text-xs font-normal text-ink-soft';

export default function MyListings() {
  usePageTitle('My Listings');
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">My listings</h1>
      <p className="mt-2 text-ink-soft">Edit your details, or take a listing down entirely.</p>
      <div className="mt-6">
        <RequireSignIn prompt="Sign in to manage your listings.">
          <MyListingsPanel />
        </RequireSignIn>
      </div>
    </div>
  );
}

function MyListingsPanel() {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetchMyProviders()
      .then(setListings)
      .catch((err) => setError(err.message));
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Delete this listing? Any requests sent to it will be deleted too. This cannot be undone.'
    );
    if (!confirmed) return;
    try {
      await deleteProvider(id);
      load();
    } catch (err) {
      setError(err.message);
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
        to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="font-medium text-rust">{error}</p>}

      {listings.map((listing) =>
        editingId === listing.id ? (
          <EditListingForm
            key={listing.id}
            listing={listing}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              load();
            }}
          />
        ) : (
          <article key={listing.id} className="border-2 border-ink/20 bg-[#fbf5e6] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{listing.name}</p>
                <p className="text-sm text-ink-soft">
                  {categoryLabel(listing.category)} · {typeLabel(listing.type)} · {listing.buildingZone}
                </p>
              </div>
              <Badge tone={listing.available ? 'pine' : 'outline'}>
                {listing.available ? 'Available' : 'Not available'}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingId(listing.id)}
                className="border-2 border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-ink hover:text-paper"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(listing.id)}
                className="border-2 border-rust px-4 py-2 text-sm font-semibold text-rust hover:bg-rust hover:text-paper"
              >
                Delete
              </button>
            </div>
          </article>
        )
      )}
    </div>
  );
}

function EditListingForm({ listing, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: listing.name,
    category: listing.category,
    type: listing.type,
    buildingZone: listing.buildingZone,
    exactLocation: listing.exactLocation,
    contactMethod: listing.contactMethod,
    specialties: listing.specialties.join(', '),
    priceRange: listing.priceRange || '',
    available: listing.available,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.buildingZone || !form.exactLocation || !form.contactMethod) {
      setError('Name, building/zone, exact location, and contact method are all required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const specialties = form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await updateProvider(listing.id, { ...form, specialties });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-2 border-navy bg-[#fbf5e6] p-4">
      <label className={labelClasses}>
        Name
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className={inputClasses}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClasses}>
          Category
          <select value={form.category} onChange={(e) => update('category', e.target.value)} className={inputClasses}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClasses}>
          Type
          <select value={form.type} onChange={(e) => update('type', e.target.value)} className={inputClasses}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClasses}>
        Building / zone
        <input
          type="text"
          value={form.buildingZone}
          onChange={(e) => update('buildingZone', e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Exact location <span className={hintClasses}>private — only shown after you accept a request</span>
        <input
          type="text"
          value={form.exactLocation}
          onChange={(e) => update('exactLocation', e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Contact method <span className={hintClasses}>private, same rule as above</span>
        <input
          type="text"
          value={form.contactMethod}
          onChange={(e) => update('contactMethod', e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Specialties <span className={hintClasses}>comma-separated</span>
        <input
          type="text"
          value={form.specialties}
          onChange={(e) => update('specialties', e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Price range <span className={hintClasses}>optional</span>
        <input
          type="text"
          value={form.priceRange}
          onChange={(e) => update('priceRange', e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
        <input
          type="checkbox"
          checked={form.available}
          onChange={(e) => update('available', e.target.checked)}
          className="h-4 w-4 accent-pine"
        />
        Available now
      </label>

      {error && <p className="text-sm font-medium text-rust">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="border-2 border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-2 border-ink/30 px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
