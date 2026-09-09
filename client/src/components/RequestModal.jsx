import { useState } from 'react';
import { createRequest } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';

export default function RequestModal({ provider, onClose, onSubmitted }) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createRequest({ providerId: provider.id, note: note.trim() || null });
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4">
      <div className="shadow-pin w-full max-w-md border-2 border-ink bg-[#fbf5e6] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Request a service from
            </p>
            <h2 className="font-display text-2xl font-semibold text-ink">{provider.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p className="mt-2 text-sm text-ink-soft">
          {provider.name}'s exact location and contact info stay private until they accept.
          They'll see this request as{' '}
          <span className="font-semibold">{user.displayName}</span>.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What are you looking for, and when works for you?"
              className="border-2 border-ink/40 bg-paper px-3 py-2 text-base text-ink focus:border-navy focus:outline-none"
            />
          </label>

          {error && <p className="text-sm font-medium text-rust">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-ink/30 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="border-2 border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
