import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function SignIn() {
  usePageTitle('Sign In');
  const { user, requestLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const [devLoginUrl, setDevLoginUrl] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const data = await requestLink(email);
      setDevLoginUrl(data.devLoginUrl || '');
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Sign in</h1>
      <p className="mt-2 text-ink-soft">
        Enter your <span className="font-semibold">@uconn.edu</span> email and we'll send you a
        link to sign in — no password to remember.
      </p>

      {status === 'sent' ? (
        <div className="mt-6 border-2 border-pine bg-pine/10 px-4 py-3 text-sm text-pine-dark">
          <p>Check your inbox at {email} for a sign-in link. It's valid for 15 minutes.</p>
          {devLoginUrl && (
            <p className="mt-3 border-t border-dashed border-pine/40 pt-3 text-xs">
              <span className="font-semibold uppercase tracking-wide">Dev mode only</span> — no
              real email is configured, so here's the link a real inbox would have received:{' '}
              <a href={devLoginUrl} className="font-semibold underline">
                open sign-in link
              </a>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            UConn email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@uconn.edu"
              className="border-2 border-ink/40 bg-[#fbf5e6] px-3 py-2 text-base text-ink focus:border-navy focus:outline-none"
            />
          </label>
          {error && <p className="text-sm font-medium text-rust">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="self-start border-2 border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}
    </div>
  );
}
