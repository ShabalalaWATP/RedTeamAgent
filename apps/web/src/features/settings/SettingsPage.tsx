import { ProviderSettings } from '../providers/ProviderSettings';
import './settings.css';

export function SettingsPage() {
  return (
    <section className="screen settings-screen">
      <div className="screen-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">AI setup for this account.</p>
        </div>
      </div>
      <div className="settings-stack">
        <ProviderSettings embedded />
      </div>
    </section>
  );
}
