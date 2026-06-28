import { AccountSecurityPanel } from './AccountSecurityPanel';
import { SiteAdminPanel } from './SiteAdminPanel';
import { ProviderSettings } from '../providers/ProviderSettings';
import { BackButton } from '../../shared/ui';
import './settings.css';

export function SettingsPage() {
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
        <SiteAdminPanel />
        <ProviderSettings embedded />
      </div>
    </section>
  );
}
