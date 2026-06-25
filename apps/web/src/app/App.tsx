import { Activity, FileText, FolderKanban, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api } from '../api/client';
import logo from '../assets/redteamagent-logo.png';
import { AuthPage } from '../features/auth/AuthPage';
import { Dashboard } from '../features/projects/Dashboard';
import { ReportPage } from '../features/reports/ReportPage';
import { NewReviewPage } from '../features/reviews/NewReviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WorkflowHistory } from '../features/workflows/WorkflowHistory';
import { Button } from '../shared/ui';
import { AuthProvider, useAuth } from './AuthContext';
import './theme.css';
import './styles.css';
import './components.css';

function Layout() {
  const { auth, setAuth } = useAuth();
  if (!auth) return <Navigate to="/auth" replace />;
  const isAdmin = isWorkspaceAdmin(auth.workspaceRole);
  const logout = async () => {
    await api.logout(auth.csrfToken);
    setAuth(null);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <img src={logo} alt="" width="32" height="32" />
          <span className="brand-name">
            RedTeamAgent
            <small>Decision intelligence</small>
          </span>
        </div>
        <nav>
          <NavLink to="/workflows"><Activity size={18} aria-hidden="true" />Workflows</NavLink>
          <NavLink to="/projects"><FolderKanban size={18} aria-hidden="true" />Projects</NavLink>
          {isAdmin ? <NavLink to="/settings"><Settings size={18} aria-hidden="true" />Settings</NavLink> : null}
        </nav>
        <p className="sidebar-foot">Adversarial review for decisions, proposals, code and writing.</p>
      </aside>
      <main>
        <header className="topbar">
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">{initials(auth.email)}</span>
            <div className="topbar-meta">
              <strong>{auth.email}</strong>
              <span className={`role-badge ${isAdmin ? 'is-admin' : ''}`}>{roleLabel(auth.workspaceRole)}</span>
            </div>
          </div>
          <Button onClick={logout}>Log out</Button>
        </header>
        <Outlet />
        <footer className="method-note">
          <FileText aria-hidden="true" size={16} />
          Reports are provisional decision support, not professional sign-off.
        </footer>
      </main>
    </div>
  );
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { auth } = useAuth();
  if (!isWorkspaceAdmin(auth?.workspaceRole ?? 'member')) return <Navigate to="/workflows" replace />;
  return children;
}

function isWorkspaceAdmin(role: string) {
  return role === 'owner' || role === 'administrator';
}

function roleLabel(role: string) {
  return isWorkspaceAdmin(role) ? 'Admin' : 'User';
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<Layout />}>
        <Route path="/workflows" element={<WorkflowHistory />} />
        <Route path="/projects" element={<Dashboard />} />
        <Route path="/dashboard" element={<Navigate to="/workflows" replace />} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        <Route path="/providers" element={<Navigate to="/settings" replace />} />
        <Route path="/enterprise" element={<Navigate to="/settings" replace />} />
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
        <Route path="/runs/:runId" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/workflows" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
