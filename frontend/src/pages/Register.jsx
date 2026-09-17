import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Nav from '../components/Nav.jsx';

export default function Register() {
  const { user, register } = useAuth();
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
      await register({
        name: String(form.get('name') || ''),
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
          <p className="eyebrow">Start following through</p>
          <h1>Create account</h1>
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required minLength={2} />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Get started'}
          </button>
          <p className="form-foot">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
