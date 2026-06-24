import { EnterprisePage } from '../enterprise/EnterprisePage';
import { ProviderSettings } from '../providers/ProviderSettings';
import './settings.css';

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
        <details className="settings-disclosure">
          <summary>
            <span>Workspace administration</span>
            <small>Members, governance, audit, API tokens, webhooks and retention controls.</small>
          </summary>
          <EnterprisePage embedded />
        </details>
      </div>
    </section>
  );
}
