import { Activity, FileText, FolderKanban, Settings, ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api } from '../api/client';
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
          <ShieldCheck aria-hidden="true" />
          <span>RedTeamAgent</span>
        </div>
        <nav>
          <NavLink to="/dashboard"><FolderKanban />Projects</NavLink>
          <NavLink to="/workflows"><Activity />Workflows</NavLink>
          {isAdmin ? <NavLink to="/settings"><Settings />Settings</NavLink> : null}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <strong>{auth.workspaceName}</strong>
            <span>{auth.email} · {roleLabel(auth.workspaceRole)}</span>
          </div>
          <Button onClick={logout}>Log out</Button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { auth } = useAuth();
  if (!isWorkspaceAdmin(auth?.workspaceRole ?? 'member')) return <Navigate to="/dashboard" replace />;
  return children;
}

function isWorkspaceAdmin(role: string) {
  return role === 'owner' || role === 'administrator';
}

function roleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workflows" element={<WorkflowHistory />} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        <Route path="/providers" element={<Navigate to="/settings" replace />} />
        <Route path="/enterprise" element={<Navigate to="/settings" replace />} />
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
        <Route path="/runs/:runId" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <footer className="method-note">
        <FileText aria-hidden="true" />
        Reports are provisional decision support, not professional sign-off.
      </footer>
    </AuthProvider>
  );
}
