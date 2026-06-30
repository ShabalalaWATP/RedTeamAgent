import { RefreshCcw } from 'lucide-react';
import type { ModelRecord, ProviderConnection } from '../../shared/types';
import { Button, EmptyState } from '../../shared/ui';

type SavedConnectionsPanelProps = {
  connections: ProviderConnection[];
  models: ModelRecord[];
  activeModelId: string;
  result: string;
  onTest: (connectionId: string) => void;
  onRefresh: (connectionId: string) => void;
};

export function SavedConnectionsPanel({
  connections,
  models,
  activeModelId,
  result,
  onTest,
  onRefresh
}: SavedConnectionsPanelProps) {
  const activeModel = models.find((model) => model.id === activeModelId) ?? null;
  const activeConnection = connections.find((connection) => connection.id === activeModel?.provider_connection_id);
  const activeReady = Boolean(activeModel?.verified && activeConnection);
  return (
    <aside className="panel stack">
      <h2>Saved connections</h2>
      <section className={`provider-active-status ${activeReady ? 'connected' : 'needs-action'}`}>
        <div>
          <strong>Current review model</strong>
          <p>
            {activeModel && activeConnection
              ? `${activeConnection.name} / ${activeModel.model_identifier}`
              : 'No workspace review model is selected yet.'}
          </p>
          <small>
            {activeReady
              ? 'Connected, tested and used for all users in this workspace. No need to select it again after login.'
              : 'An owner must select and test one model before production reviews can run.'}
          </small>
        </div>
        <span className={`status-chip ${activeReady ? 'success' : 'warning'}`}>
          {activeReady ? 'Connected' : 'Action required'}
        </span>
      </section>
      {connections.length === 0 ? (
        <EmptyState title="No saved provider" body="Save the provider TheAllSeeingEye should use for reviews." />
      ) : (
        <div className="list">
          {connections.map((connection) => {
            const connectionModels = models.filter((model) => model.provider_connection_id === connection.id);
            const selectedModel = connectionModels.find((model) => model.id === activeModelId);
            const verifiedModel = connectionModels.find((model) => model.verified);
            return (
              <article className="list-item" key={connection.id}>
                <div>
                  <strong>{connection.name}</strong>
                  <p className="muted">
                    {connection.adapter} · {selectedModel?.model_identifier ?? 'no selected model'}
                  </p>
                  <div className="row">
                    <span className={`status-chip ${selectedModel ? 'success' : 'warning'}`}>
                      {selectedModel ? 'Selected' : 'Needs selection'}
                    </span>
                    <span className={`status-chip ${verifiedModel ? 'success' : 'warning'}`}>
                      {verifiedModel ? 'Tested' : 'Needs test'}
                    </span>
                    <span className="muted">credentials {connection.has_credentials ? 'stored' : 'not required'}</span>
                  </div>
                </div>
                <div className="row">
                  <Button type="button" onClick={() => onTest(connection.id)}>
                    <RefreshCcw size={16} /> Test
                  </Button>
                  <Button type="button" onClick={() => onRefresh(connection.id)}>
                    Select and test
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="muted">
        {result || (
          activeReady
            ? 'Provider changes are owner-controlled and should only be needed when rotating keys or changing models.'
            : 'Select and test one saved provider before running reviews.'
        )}
      </p>
    </aside>
  );
}
