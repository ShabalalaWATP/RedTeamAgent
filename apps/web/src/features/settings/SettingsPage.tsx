import { EnterprisePage } from '../enterprise/EnterprisePage';
import { ProviderSettings } from '../providers/ProviderSettings';

export function SettingsPage() {
  return (
    <section className="screen settings-screen">
      <div className="screen-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Admin-only AI provider setup, workspace policy and operational controls.</p>
        </div>
      </div>
      <div className="settings-stack">
        <ProviderSettings embedded />
        <EnterprisePage embedded />
      </div>
    </section>
  );
}
