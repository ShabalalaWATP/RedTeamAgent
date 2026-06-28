import { Activity, FolderKanban, Settings, ShieldCheck } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import logo from '../assets/redteamagent-logo.png';
import { AuthPage } from '../features/auth/AuthPage';
import { Dashboard } from '../features/projects/Dashboard';
import { ReportPage } from '../features/reports/ReportPage';
import { NewReviewPage } from '../features/reviews/NewReviewPage';
import { AccountSecurityPanel } from '../features/settings/AccountSecurityPanel';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WorkflowHistory } from '../features/workflows/WorkflowHistory';
import type { AuthState } from '../shared/types';
import { Button } from '../shared/ui';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeToggle } from './ThemeToggle';
import './theme.css';
import './styles.css';
import './components.css';
import './effects.css';

function Layout() {
  const { auth, setAuth } = useAuth();
  if (!auth) return <Navigate to="/auth" replace />;
  const isAdmin = isWorkspaceAdmin(auth.workspaceRole);
  const isPrivileged = isAdmin || isSiteAdmin(auth.accountType);
  const canAccessSettings = isAdmin || isSiteAdmin(auth.accountType);
  const logout = async () => {
    await api.logout(auth.csrfToken);
    setAuth(null);
  };
  if (isPrivilegedMfaPending(auth)) {
    return <PrivilegedMfaGate auth={auth} logout={logout} />;
  }
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <img src={logo} alt="" width="40" height="40" />
          <span className="brand-name">
            RedTeamAgent
            <small>Decision intelligence</small>
          </span>
        </div>
        <nav>
          <NavLink to="/workflows"><Activity size={18} aria-hidden="true" />Workflows</NavLink>
          <NavLink to="/projects"><FolderKanban size={18} aria-hidden="true" />Projects</NavLink>
          {canAccessSettings ? <NavLink to="/settings"><Settings size={18} aria-hidden="true" />Settings</NavLink> : null}
        </nav>
        <p className="sidebar-foot">Adversarial review for decisions, proposals, code and writing.</p>
      </aside>
      <main>
        <header className="topbar">
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">{initials(auth.email)}</span>
            <div className="topbar-meta">
              <strong>{auth.email}</strong>
              <span className={`role-badge ${isPrivileged ? 'is-admin' : ''}`}>{accountLabel(auth)}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Button onClick={logout}>Log out</Button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function PrivilegedMfaGate({ auth, logout }: { auth: AuthState; logout: () => void }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <img src={logo} alt="" width="40" height="40" />
          <span className="brand-name">
            RedTeamAgent
            <small>Decision intelligence</small>
          </span>
        </div>
        <p className="sidebar-foot">Privileged accounts require authenticator-app MFA and a verified passkey.</p>
      </aside>
      <main>
        <header className="topbar">
          <div className="topbar-user">
            <ShieldCheck aria-hidden="true" size={20} />
            <div className="topbar-meta">
              <strong>{auth.email}</strong>
              <span className="role-badge is-admin">{accountTypeLabel(auth.accountType)}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Button onClick={logout}>Log out</Button>
          </div>
        </header>
        <section className="screen settings-screen">
          <div className="screen-header">
            <div>
              <h1>Secure account access</h1>
              <p className="muted">Complete the required MFA checks before using the app.</p>
            </div>
          </div>
          <AccountSecurityPanel />
        </section>
      </main>
    </div>
  );
}

function VisitTracker() {
  const location = useLocation();
  useEffect(() => {
    /* v8 ignore next 2 -- production-only visitor tracking is disabled under Vitest. */
    if (import.meta.env.MODE === 'test') return;
    void api.recordVisit(location.pathname);
  }, [location.pathname]);
  return null;
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { auth } = useAuth();
  if (!isWorkspaceAdmin(auth?.workspaceRole ?? 'member') && !isSiteAdmin(auth?.accountType ?? 'user')) {
    return <Navigate to="/workflows" replace />;
  }
  return children;
}

function isWorkspaceAdmin(role: string) {
  return role === 'owner' || role === 'administrator';
}

function isSiteAdmin(role: string) {
  return role === 'owner' || role === 'admin';
}

function isPrivilegedMfaPending(auth: { accountType: string; mfaSetupRequired: boolean; passkeyVerificationRequired: boolean }) {
  return isSiteAdmin(auth.accountType) && (auth.mfaSetupRequired || auth.passkeyVerificationRequired);
}

function accountLabel(auth: AuthState) {
  if (auth.accountType === 'owner' || auth.workspaceRole === 'owner') return 'Owner';
  if (auth.accountType === 'admin' || auth.workspaceRole === 'administrator') return 'Admin';
  return 'User';
}

function accountTypeLabel(role: string) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'User';
}

function AppRoutes() {
  return (
    <>
      <VisitTracker />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<Layout />}>
          <Route path="/workflows" element={<WorkflowHistory />} />
          <Route path="/projects" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/workflows" replace />} />
          <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
          <Route path="/providers" element={<Navigate to="/settings" replace />} />
          <Route path="/enterprise" element={<Navigate to="/settings" replace />} />
          <Route path="/reviews/new" element={<NewReviewPage />} />
          <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
          <Route path="/runs/:runId" element={<ReportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/workflows" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
