import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { api } from '../api.js';

function Shell({ children }) {
  return (
    <div className="page app-page">
      <Nav />
      <main className="workspace single">
        <div className="panel compose wide">{children}</div>
      </main>
    </div>
  );
}

function collaboratorState(name, members, team) {
  const key = String(name || '').trim().toLowerCase();
  const extracted = members.find((member) => member.name.toLowerCase() === key);
  const onTeam = team.find((member) => member.name.toLowerCase() === key);
  if (onTeam?.ready || extracted?.ready) return 'ready';
  if (onTeam || extracted?.onTeam) return 'waiting';
  return 'missing';
}

function missingOwners(tasks, members, team) {
  return [
    ...new Set(
      tasks
        .filter((item) => item.include)
        .map((item) => item.owner)
        .filter((name) => name && name.toLowerCase() !== 'unassigned')
        .filter((name) => collaboratorState(name, members, team) === 'missing'),
    ),
  ];
}

function ReviewTask({ item, index, onChange, onKeep, onSkip, collab }) {
  return (
    <li className={item.include ? undefined : 'skipped'}>
      <div className="task-fields stacked">
        <label>
          Task
          <input
            value={item.task}
            onChange={(event) => onChange(index, { task: event.target.value })}
            disabled={!item.include}
          />
        </label>
        <div className="task-fields">
          <label>
            Owner
            <input
              value={item.owner}
              onChange={(event) => onChange(index, { owner: event.target.value })}
              disabled={!item.include}
            />
          </label>
          <label>
            Deadline
            <input
              value={item.deadline}
              onChange={(event) => onChange(index, { deadline: event.target.value })}
              disabled={!item.include}
            />
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={item.priority || 'medium'}
              onChange={(event) => onChange(index, { priority: event.target.value })}
              disabled={!item.include}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        {item.detail ? <p className="task-detail">{item.detail}</p> : null}
        <p className={`collab-flag ${collab}`}>
          {collab === 'ready' && 'Ready to assign'}
          {collab === 'waiting' && 'On the team — waiting for their account'}
          {collab === 'missing' && 'Not on the team'}
        </p>
      </div>
      <div className="keep-skip">
        <button type="button" className={item.include ? 'btn btn-keep' : 'btn btn-ghost'} onClick={onKeep}>
          Keep
        </button>
        <button type="button" className={item.include ? 'btn btn-ghost' : 'btn btn-skip'} onClick={onSkip}>
          Skip
        </button>
      </div>
    </li>
  );
}

function MissingPeople({ missing, addName, addEmail, pending, onName, onEmail, onAdd }) {
  return (
    <div className="panel nested">
      <h3>Add missing people</h3>
      <p className="muted">{missing.join(', ')} still need to be on this project.</p>
      <div className="inline-form">
        <label>
          Name
          <input value={addName} onChange={(event) => onName(event.target.value)} placeholder={missing[0]} />
        </label>
        <label>
          Email
          <input value={addEmail} onChange={(event) => onEmail(event.target.value)} type="email" placeholder="Optional" />
        </label>
        <button
          className="btn btn-primary"
          type="button"
          onClick={onAdd}
          disabled={pending || (addName.trim() || missing[0] || '').length < 2}
        >
          Add person
        </button>
      </div>
    </div>
  );
}

function ReviewForm({
  meeting,
  tasks,
  members,
  team,
  missing,
  error,
  pending,
  addName,
  addEmail,
  projectPath,
  onChange,
  onConfirm,
  onAdd,
  onName,
  onEmail,
}) {
  const kept = tasks.filter((item) => item.include).length;
  return (
    <div className="page app-page">
      <Nav />
      <main className="workspace single">
        <form className="panel compose wide" onSubmit={onConfirm}>
          <p className="eyebrow">{meeting.project?.name || 'Human review'}</p>
          <h1>Review the draft</h1>
          <p className="muted">Edit anything that’s off. Add missing people, then approve to put work on the board.</p>
          <h3>Work</h3>
          {tasks.length === 0 ? (
            <p className="muted">Nothing to send from this transcript.</p>
          ) : (
            <ul className="hitl-list simple">
              {tasks.map((item, index) => (
                <ReviewTask
                  key={item.id}
                  item={item}
                  index={index}
                  collab={collaboratorState(item.owner, members, team)}
                  onChange={onChange}
                  onKeep={() => onChange(index, { include: true })}
                  onSkip={() => onChange(index, { include: false })}
                />
              ))}
            </ul>
          )}
          {meeting.decisions?.length > 0 && (
            <details className="notes">
              <summary>Decisions from the meeting</summary>
              <ul className="decision-list">
                {meeting.decisions.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            </details>
          )}
          {missing.length > 0 && (
            <MissingPeople
              missing={missing}
              addName={addName}
              addEmail={addEmail}
              pending={pending}
              onName={onName}
              onEmail={onEmail}
              onAdd={onAdd}
            />
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="compose-actions">
            <button className="btn btn-primary" type="submit" disabled={pending || kept === 0 || missing.length > 0}>
              {pending ? 'Approving…' : `Approve ${kept} ${kept === 1 ? 'task' : 'tasks'}`}
            </button>
            <Link className="btn btn-ghost" to={`${projectPath}?tab=meetings`}>
              Back
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function Review() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [meeting, setMeeting] = useState(null);
  const [members, setMembers] = useState([]);
  const [team, setTeam] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    api(`/meetings/${id}`)
      .then((data) => {
        if (cancelled) return;
        const next = data.meeting;
        setMeeting(next);
        setMembers(next.members || []);
        setTeam(next.project?.members || []);
        setTasks(
          next.actions.map((item) => ({
            ...item,
            include: true,
            detail: item.detail || '',
            deadline: item.deadline || '',
            priority: item.priority || 'medium',
          })),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const projectPath = `/app/projects/${projectId || meeting?.projectId || ''}`;
  const missing = missingOwners(tasks, members, team);

  function changeTask(index, patch) {
    setTasks((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function addCollaborator(event) {
    event.preventDefault();
    const pid = projectId || meeting?.projectId;
    if (!pid) return;
    setError('');
    setPending(true);
    try {
      const data = await api(`/projects/${pid}/members`, {
        method: 'POST',
        body: { name: addName.trim() || missing[0], email: addEmail },
      });
      setTeam((current) => [...current.filter((member) => member.id !== data.member.id), data.member]);
      setMembers((current) => {
        const key = data.member.name.toLowerCase();
        const exists = current.some((member) => member.name.toLowerCase() === key);
        if (!exists) return [...current, { name: data.member.name, onTeam: true, ready: data.member.ready, matchedUser: null }];
        return current.map((member) =>
          member.name.toLowerCase() === key
            ? { ...member, onTeam: true, ready: data.member.ready }
            : member,
        );
      });
      setAddName('');
      setAddEmail('');
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await api(`/meetings/${id}/confirm`, {
        method: 'POST',
        body: {
          projectId: Number(projectId || meeting.projectId),
          members: [...team, ...members].map((member) => ({
            name: member.name,
            include: true,
            userId: member.userId || member.matchedUser?.id || null,
          })),
          actions: tasks.map((item) => ({
            id: item.id,
            include: item.include,
            owner: item.owner,
            task: item.task,
            detail: item.detail || null,
            deadline: item.deadline || null,
            priority: item.priority,
          })),
        },
      });
      navigate(`${projectPath}?tab=tasks`);
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  if (!meeting && !error) {
    return (
      <div className="page splash">
        <p>Preparing the review…</p>
      </div>
    );
  }
  if (!meeting) {
    return (
      <Shell>
        <h1>Couldn’t open this review</h1>
        <p className="muted">It may have been sent already, or the link is no longer valid.</p>
        <Link className="btn btn-primary" to="/app">
          Back to projects
        </Link>
      </Shell>
    );
  }
  if (meeting.status === 'confirmed') {
    return (
      <Shell>
        <h1>Already approved</h1>
        <p className="muted">These tasks are already on the project board.</p>
        <Link className="btn btn-primary" to={`${projectPath}?tab=tasks`}>
          Open task board
        </Link>
      </Shell>
    );
  }

  return (
    <ReviewForm
      meeting={meeting}
      tasks={tasks}
      members={members}
      team={team}
      missing={missing}
      error={error}
      pending={pending}
      addName={addName}
      addEmail={addEmail}
      projectPath={projectPath}
      onChange={changeTask}
      onConfirm={handleConfirm}
      onAdd={addCollaborator}
      onName={setAddName}
      onEmail={setAddEmail}
    />
  );
}
