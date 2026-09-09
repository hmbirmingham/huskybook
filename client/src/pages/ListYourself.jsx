import { useState } from 'react';
import { createProvider } from '../lib/api.js';
import { CATEGORIES, TYPES } from '../lib/constants.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { useAuth } from '../lib/AuthContext.jsx';
import RequireSignIn from '../components/RequireSignIn.jsx';

const inputClasses =
  'border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-base text-ink focus:border-navy focus:outline-none';
const labelClasses = 'flex flex-col gap-1 text-sm font-medium text-ink';
const hintClasses = 'text-xs font-normal text-ink-soft';

export default function ListYourself() {
  usePageTitle('List Yourself');
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">List yourself</h1>
      <p className="mt-2 text-ink-soft">
        Your building/zone shows up on the directory. Your exact room number and contact info stay
        private — they're only revealed to a requester once you accept their request.
      </p>
      <div className="mt-6">
        <RequireSignIn prompt="Sign in to list yourself as a provider.">
          <ListYourselfForm />
        </RequireSignIn>
      </div>
    </div>
  );
}

function ListYourselfForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user.displayName || '',
    category: 'hair',
    type: 'dorm',
    buildingZone: '',
    exactLocation: '',
    contactMethod: '',
    specialties: '',
    priceRange: '',
    available: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [listing, setListing] = useState(null);

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
      const created = await createProvider({ ...form, specialties });
      setListing(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (listing) {
    return (
      <div>
        <p className="border-2 border-pine bg-pine/10 px-4 py-3 text-sm font-medium text-pine-dark">
          {listing.name} is now on the directory under {listing.buildingZone}. Your exact location
          ({listing.exactLocation}) and contact info stay private until you accept a request —
          check <span className="font-semibold">Manage Requests</span> for anyone who reaches out.
        </p>
        <button
          type="button"
          onClick={() => setListing(null)}
          className="mt-6 border-2 border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-ink hover:text-paper"
        >
          List another service
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className={labelClasses}>
        Name <span className={hintClasses}>shown on this listing — can differ from your account name</span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Priya S."
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
        Building / zone <span className={hintClasses}>shown publicly on the directory</span>
        <input
          type="text"
          value={form.buildingZone}
          onChange={(e) => update('buildingZone', e.target.value)}
          placeholder="e.g. Shippee Hall or North Campus"
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Exact location <span className={hintClasses}>private — only shown after you accept a request</span>
        <input
          type="text"
          value={form.exactLocation}
          onChange={(e) => update('exactLocation', e.target.value)}
          placeholder="e.g. Room 118"
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Contact method <span className={hintClasses}>private, same rule as above</span>
        <input
          type="text"
          value={form.contactMethod}
          onChange={(e) => update('contactMethod', e.target.value)}
          placeholder="e.g. @yourhandle or a number to text"
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Specialties <span className={hintClasses}>comma-separated, optional</span>
        <input
          type="text"
          value={form.specialties}
          onChange={(e) => update('specialties', e.target.value)}
          placeholder="e.g. gel-x, nail art"
          className={inputClasses}
        />
      </label>

      <label className={labelClasses}>
        Price range <span className={hintClasses}>optional</span>
        <input
          type="text"
          value={form.priceRange}
          onChange={(e) => update('priceRange', e.target.value)}
          placeholder="e.g. $25-45"
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

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 self-start border-2 border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? 'Posting…' : 'Post my listing'}
      </button>
    </form>
  );
}
