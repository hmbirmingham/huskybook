import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function VerifyLogin() {
  usePageTitle('Signing In');
  const [searchParams] = useSearchParams();
  const { verify, setDisplayName } = useAuth();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState('verifying'); // verifying | needsName | error
  const [error, setError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  // A login token is single-use server-side, but React 18 StrictMode
  // double-invokes effects in dev (mount → unmount → mount) specifically to
  // surface non-idempotent side effects like this one — without this guard,
  // the second invocation would consume an already-used token and fail.
  const verifyStarted = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Missing sign-in token.');
      return;
    }
    if (verifyStarted.current) return;
    verifyStarted.current = true;

    verify(token)
      .then((user) => {
        if (user.displayName) {
          navigate('/', { replace: true });
        } else {
          setState('needsName');
        }
      })
      .catch((err) => {
        setState('error');
        setError(err.message);
      });
    // Runs once for the token in the URL — verify/navigate are stable
    // useCallback references from AuthContext, not deps that should re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSaveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await setDisplayName(nameInput);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === 'verifying') {
    return (
      <div className="mx-auto max-w-md px-5 py-8">
        <p className="text-ink-soft">Signing you in…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Sign-in link didn't work</h1>
        <p className="mt-2 font-medium text-rust">{error}</p>
        <p className="mt-4 text-ink-soft">
          Links expire after 15 minutes and only work once.{' '}
          <a href="/login" className="font-semibold text-navy underline">
            Request a new one
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">One more thing</h1>
      <p className="mt-2 text-ink-soft">
        What name should providers and requesters see for you? This is separate from your email —
        a first name and last initial is plenty if you'd rather not share your full name.
      </p>
      <form onSubmit={handleSaveName} className="mt-6 flex flex-col gap-4">
        <input
          type="text"
          required
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. Priya S."
          className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-base text-ink focus:border-navy focus:outline-none"
        />
        {error && <p className="text-sm font-medium text-rust">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start border-2 border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
