import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { api } from '../api.js';

function ProgressBar({ percent }) {
  return (
    <div className="progress" aria-label={`Project ${percent}% complete`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/projects');
        if (!cancelled) setProjects(data.projects);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const data = await api('/projects', { method: 'POST', body: { name } });
      setName('');
      setProjects((current) => [data.project, ...current]);
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  return (
    <div className="page app-page">
      <Nav />
      <main className="workspace single">
        <section className="panel compose wide">
          <p className="eyebrow">Dashboard</p>
          <h1>All projects</h1>
          <p className="muted">Pick a project. Meetings, people, and tasks stay together inside it.</p>
          <form className="inline-form" onSubmit={handleSubmit}>
            <label>
              New project
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Launch week"
                required
                minLength={2}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
        </section>

        {projects.length === 0 ? (
          <section className="panel compose wide">
            <p className="muted">No projects yet. Create one to add meetings and a team.</p>
          </section>
        ) : (
          <ul className="project-grid">
            {projects.map((project) => (
              <li key={project.id}>
                <Link className="project-card" to={`/app/projects/${project.id}`}>
                  <strong>{project.name}</strong>
                  <ProgressBar percent={project.progress?.percent || 0} />
                  <span className="work-meta">
                    {project.progress?.completed || 0}/{project.progress?.total || 0} done
                    {project.pendingReviews ? ` · ${project.pendingReviews} to review` : ''}
                  </span>
                  <span className="work-meta">
                    {project.memberCount || 0} people · {project.meetingCount || 0} meetings
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
