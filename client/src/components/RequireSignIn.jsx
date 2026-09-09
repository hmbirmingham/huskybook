import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

// Shared gate for the three flows that now need a real account instead of
// a typed name: List Yourself, My Requests, Manage Requests.
export default function RequireSignIn({ children, prompt }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-ink-soft">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="text-ink-soft">
        {prompt || 'Sign in to continue.'}{' '}
        <Link to="/login" className="font-semibold text-navy underline">
          Sign in
        </Link>
        .
      </p>
    );
  }

  return children;
}
