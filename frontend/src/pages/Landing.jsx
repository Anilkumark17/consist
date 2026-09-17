import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Nav from '../components/Nav.jsx';

const FOLLOW_UPS = ['Anil → Deliver the API · Friday', 'Rahul → Send design mocks · Wednesday'];

export default function Landing() {
  const { user, loading } = useAuth();
  const primary = user ? '/app' : '/register';
  const primaryLabel = user ? 'Open workspace' : 'Start a project';

  return (
    <div className="page landing">
      <Nav variant="landing" />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Project → meeting → board</p>
            <h1>
              Meetings
              <br />
              without the
              <br />
              drift.
            </h1>
            <p className="lede">
              Every transcript lives in a project, so people, tasks, and progress stay in one place.
            </p>
            <div className="hero-actions">
              {!loading && (
                <>
                  <Link className="btn btn-primary" to={primary}>
                    {primaryLabel}
                  </Link>
                  {!user && (
                    <Link className="btn btn-ghost" to="/login">
                      Sign in
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="pipeline" aria-label="Product pipeline">
            <div className="pipe-step">
              <span>01</span>
              <p>Open a project</p>
            </div>
            <div className="pipe-step accent">
              <span>02</span>
              <p>Review the AI draft</p>
            </div>
            <div className="pipe-step">
              <span>03</span>
              <p>Work moves on the board</p>
            </div>
            <ul className="chips">
              {FOLLOW_UPS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        </section>

        <section id="how" className="how">
          <h2>How work stays consistent</h2>
          <div className="how-grid">
            <article>
              <h3>Project</h3>
              <p>Start from a project. Team, meetings, and tasks all belong to it.</p>
            </article>
            <article>
              <h3>Review</h3>
              <p>Extract a transcript, edit the draft, and add anyone who isn’t on the team yet.</p>
            </article>
            <article>
              <h3>Board</h3>
              <p>Approved work appears on the project board. Finished tasks raise project progress.</p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer">Consist keeps the thread.</footer>
    </div>
  );
}
