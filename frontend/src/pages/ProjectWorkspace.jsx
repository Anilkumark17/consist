import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { api } from '../api.js';
import TaskCard from '../components/TaskCard.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'team', label: 'Team' },
];

const BOARD = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'completed', label: 'Completed' },
];

function Shell({ children }) {
  return (
    <div className="page app-page">
      <Nav />
      <main className="workspace project-shell">{children}</main>
    </div>
  );
}

function OverviewTab({ project }) {
  const pending = project.meetings.filter((meeting) => meeting.status === 'pending_review');
  return (
    <section className="results">
      <div className="panel">
        <p className="eyebrow">Progress</p>
        <h2>{project.progress.percent}% complete</h2>
        <div className="progress large" aria-hidden="true">
          <span style={{ width: `${project.progress.percent}%` }} />
        </div>
        <p className="muted">
          {project.progress.completed} of {project.progress.total} tasks finished.
        </p>
      </div>
      <div className="stat-grid">
        <article className="panel">
          <p className="eyebrow">Meetings</p>
          <h2>{project.meetings.length}</h2>
        </article>
        <article className="panel">
          <p className="eyebrow">Team</p>
          <h2>{project.members.length}</h2>
        </article>
        <article className="panel">
          <p className="eyebrow">On the board</p>
          <h2>{project.actions.length}</h2>
        </article>
      </div>
      {pending.length > 0 && (
        <div className="panel">
          <p className="eyebrow">Needs review</p>
          <ul className="review-list">
            {pending.map((meeting) => (
              <li key={meeting.id}>
                <strong>{meeting.title}</strong>
                <Link className="btn btn-primary" to={`/app/projects/${project.id}/meetings/${meeting.id}`}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TasksTab({ project, onStatus }) {
  const columns = useMemo(
    () =>
      BOARD.map((column) => ({
        ...column,
        items: project.actions.filter((item) => item.status === column.id),
      })),
    [project.actions],
  );

  return (
    <section className="board">
      {columns.map((column) => (
        <div key={column.id} className="board-col panel">
          <p className="eyebrow">
            {column.label} · {column.items.length}
          </p>
          {column.items.length === 0 ? (
            <p className="muted">None</p>
          ) : (
            <ul className="action-db">
              {column.items.map((item) => (
                <li key={item.id}>
                  <TaskCard item={item} onStatus={onStatus} columns={BOARD} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function MeetingsTab({ project }) {
  return (
    <section className="panel compose wide">
      <div className="row-head">
        <div>
          <p className="eyebrow">Meetings</p>
          <h2>Transcripts in this project</h2>
        </div>
        <Link className="btn btn-primary" to={`/app/projects/${project.id}/meetings/new`}>
          Add meeting
        </Link>
      </div>
      {project.meetings.length === 0 ? (
        <p className="muted">No meetings yet. Add one to extract tasks.</p>
      ) : (
        <ul className="review-list">
          {project.meetings.map((meeting) => (
            <li key={meeting.id}>
              <div className="stack">
                <strong>{meeting.title}</strong>
                <span className="work-meta">
                  {meeting.status === 'pending_review' ? 'Needs review' : 'Approved'}
                </span>
              </div>
              <Link
                className="btn btn-ghost"
                to={
                  meeting.status === 'pending_review'
                    ? `/app/projects/${project.id}/meetings/${meeting.id}`
                    : `/app/projects/${project.id}?tab=tasks`
                }
              >
                {meeting.status === 'pending_review' ? 'Review' : 'Board'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamTab({ project, onAdd }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await onAdd({ name, email });
      setName('');
      setEmail('');
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  return (
    <section className="workspace">
      <form className="panel compose" onSubmit={handleSubmit}>
        <h2>Add a person</h2>
        <p className="muted">They must be on this team before a task can be assigned.</p>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
        </label>
        <label>
          Email <span className="work-meta">(optional)</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="If they already have an account" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add collaborator'}
        </button>
      </form>
      <div className="panel">
        <p className="eyebrow">Team</p>
        <ul className="member-list">
          {project.members.map((member) => (
            <li key={member.id}>
              <strong>{member.name}</strong>
              <span>{member.ready ? 'Ready to assign' : 'Add their account later'}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'overview';
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api(`/projects/${id}`)
      .then((data) => {
        if (!cancelled) setProject(data.project);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleStatus(item, status) {
    setError('');
    try {
      const data = await api(`/actions/${item.id}`, { method: 'PATCH', body: { status } });
      setProject((current) => {
        if (!current) return current;
        const actions = current.actions.map((row) => (row.id === item.id ? { ...row, ...data.action } : row));
        const total = actions.length;
        const completed = actions.filter((row) => row.status === 'completed').length;
        return {
          ...current,
          actions,
          progress: { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 },
        };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(payload) {
    const data = await api(`/projects/${id}/members`, { method: 'POST', body: payload });
    setProject((current) =>
      current
        ? {
            ...current,
            members: [...current.members.filter((member) => member.id !== data.member.id), data.member],
          }
        : current,
    );
  }

  if (!project && !error) {
    return (
      <div className="page splash">
        <p>Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <Shell>
        <section className="panel compose wide">
          <h1>Couldn’t open this project</h1>
          <p className="muted">It may have been removed, or you no longer have access.</p>
          <Link className="btn btn-primary" to="/app">
            Back to projects
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="panel compose wide project-head">
        <p className="eyebrow">Project workspace</p>
        <h1>{project.name}</h1>
        <nav className="tabs" aria-label="Project sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'tab current' : 'tab'}
              onClick={() => setParams({ tab: item.id })}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>
      {error && <p className="form-error">{error}</p>}
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks' && <TasksTab project={project} onStatus={handleStatus} />}
      {tab === 'meetings' && <MeetingsTab project={project} />}
      {tab === 'team' && <TeamTab project={project} onAdd={handleAdd} />}
    </Shell>
  );
}
