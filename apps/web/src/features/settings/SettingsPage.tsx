import { AccountSecurityPanel } from './AccountSecurityPanel';
import { SiteAdminPanel } from './SiteAdminPanel';
import { ProviderSettings } from '../providers/ProviderSettings';
import { useAuth } from '../../app/AuthContext';
import { BackButton } from '../../shared/ui';
import './settings.css';

export function SettingsPage() {
  const { auth } = useAuth();
  const canManageProviders = Boolean(
    auth &&
      auth.accountType !== 'admin' &&
      (auth.accountType === 'owner' || auth.workspaceRole === 'owner' || auth.workspaceRole === 'administrator')
  );

  return (
    <section className="screen settings-screen">
      <div className="screen-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">AI setup for this account.</p>
        </div>
        <BackButton fallback="/workflows" />
      </div>
      <div className="settings-stack">
        <AccountSecurityPanel />
        {canManageProviders ? <ProviderSettings embedded /> : null}
        <SiteAdminPanel />
      </div>
    </section>
  );
}
