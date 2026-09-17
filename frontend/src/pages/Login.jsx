import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Nav from '../components/Nav.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await login({
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
      });
      navigate('/app');
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  return (
    <div className="page auth-page">
      <Nav variant="landing" />
      <main className="auth-wrap">
        <form className="panel" onSubmit={handleSubmit}>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="form-foot">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
