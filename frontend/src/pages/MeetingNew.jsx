import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { api, SAMPLE_TRANSCRIPT } from '../api.js';

export default function MeetingNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/projects/${id}`)
      .then((data) => {
        if (cancelled) return;
        setProject(data.project);
        const names = (data.project.members || []).map((member) => member.name).join(', ');
        setParticipants(names);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const data = await api('/meetings', {
        method: 'POST',
        body: { projectId: Number(id), title, date, participants, transcript },
      });
      navigate(`/app/projects/${id}/meetings/${data.meeting.id}`);
    } catch (err) {
      setError(err.message);
    }
    setPending(false);
  }

  return (
    <div className="page app-page">
      <Nav />
      <main className="workspace single">
        <form className="panel compose wide" onSubmit={handleSubmit}>
          <p className="eyebrow">{project?.name || 'Project'}</p>
          <h1>New meeting</h1>
          <p className="muted">Add what was said. We’ll draft tasks, people, deadlines, and decisions.</p>

          {pending ? (
            <ul className="extract-status" aria-live="polite">
              <li>Reading the transcript</li>
              <li>Drafting tasks, people, and deadlines</li>
              <li>Noting decisions and priority</li>
            </ul>
          ) : (
            <>
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly sync" />
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                Participants
                <input
                  value={participants}
                  onChange={(event) => setParticipants(event.target.value)}
                  placeholder="Anil, Rahul, Priya"
                />
              </label>
              <label>
                Transcript
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="Anil: I'll take the API by Friday."
                  required
                  minLength={10}
                  rows={10}
                />
              </label>
            </>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="compose-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Extracting…' : 'Extract tasks'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)} disabled={pending}>
              Try a sample
            </button>
            <Link className="btn btn-ghost" to={`/app/projects/${id}?tab=meetings`}>
              Back
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
