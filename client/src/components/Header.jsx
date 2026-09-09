import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Find a Service', end: true },
  { to: '/list', label: 'List Yourself' },
  { to: '/my-requests', label: 'My Requests' },
  { to: '/manage', label: 'Manage Requests' },
];

export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight text-navy">
            HuskyBook<span className="text-amber">.</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Student-run hair, nails, makeup &amp; braids — posted by whoever's around.
          </p>
        </div>

        {!loading && (
          <div className="text-sm">
            {user ? (
              <span className="flex items-center gap-2 text-ink-soft">
                Signed in as <span className="font-semibold text-ink">{user.displayName || user.email}</span>
                <button type="button" onClick={handleLogout} className="font-semibold text-navy underline">
                  Sign out
                </button>
              </span>
            ) : (
              <NavLink to="/login" className="font-semibold text-navy underline">
                Sign in
              </NavLink>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-5">
        <nav className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-t-sm border-2 border-b-0 px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-ink bg-ink text-paper'
                    : 'border-transparent text-ink-soft hover:border-ink/30 hover:text-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
