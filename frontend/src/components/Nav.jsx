import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Nav({ variant = 'app' }) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className={`nav nav-${variant}`}>
      <Link className="brand" to={user ? '/app' : '/'}>
        <span className="brand-mark" aria-hidden="true" />
        Consist
      </Link>
      {variant === 'landing' ? (
        <nav className="nav-links">
          <a href="#how">How it works</a>
          {loading ? null : user ? (
            <Link className="btn btn-primary" to="/app">
              Open workspace
            </Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="btn btn-primary" to="/register">
                Get started
              </Link>
            </>
          )}
        </nav>
      ) : (
        <nav className="nav-links">
          {user && <span className="nav-user">{user.name}</span>}
          <NavLink to="/app" end>
            Projects
          </NavLink>
          <button type="button" className="text-btn" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
