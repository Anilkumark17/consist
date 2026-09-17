import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Intake from './pages/Intake.jsx';
import MeetingNew from './pages/MeetingNew.jsx';
import Review from './pages/Review.jsx';
import Projects from './pages/Projects.jsx';
import ProjectWorkspace from './pages/ProjectWorkspace.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page splash">
        <p>Loading Consist…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/app"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/app/intake"
            element={
              <Protected>
                <Intake />
              </Protected>
            }
          />
          <Route
            path="/app/review/:id"
            element={
              <Protected>
                <Review />
              </Protected>
            }
          />
          <Route
            path="/app/projects"
            element={
              <Protected>
                <Projects />
              </Protected>
            }
          />
          <Route
            path="/app/projects/:id"
            element={
              <Protected>
                <ProjectWorkspace />
              </Protected>
            }
          />
          <Route
            path="/app/projects/:id/meetings/new"
            element={
              <Protected>
                <MeetingNew />
              </Protected>
            }
          />
          <Route
            path="/app/projects/:projectId/meetings/:id"
            element={
              <Protected>
                <Review />
              </Protected>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
