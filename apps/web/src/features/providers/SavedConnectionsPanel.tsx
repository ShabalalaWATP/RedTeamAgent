import { RefreshCcw } from 'lucide-react';
import type { ProviderConnection } from '../../shared/types';
import { Button, EmptyState } from '../../shared/ui';

type SavedConnectionsPanelProps = {
  connections: ProviderConnection[];
  result: string;
  onTest: (connectionId: string) => void;
  onRefresh: (connectionId: string) => void;
};

export function SavedConnectionsPanel({
  connections,
  result,
  onTest,
  onRefresh
}: SavedConnectionsPanelProps) {
  return (
    <aside className="panel stack">
      <h2>Saved connections</h2>
      {connections.length === 0 ? (
        <EmptyState title="No saved provider" body="Save the provider RedTeamAgent should use for reviews." />
      ) : (
        <div className="list">
          {connections.map((connection) => (
            <article className="list-item" key={connection.id}>
              <div>
                <strong>{connection.name}</strong>
                <p className="muted">
                  {connection.adapter} · credentials {connection.has_credentials ? 'stored' : 'not required'}
                </p>
              </div>
              <div className="row">
                <Button type="button" onClick={() => onTest(connection.id)}>
                  <RefreshCcw size={16} /> Test
                </Button>
                <Button type="button" onClick={() => onRefresh(connection.id)}>
                  Refresh models + verify
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="muted">{result || 'Refresh a saved provider to verify its review model.'}</p>
    </aside>
  );
}
