import type { ModelRecord } from '../../shared/types';
import { Button, EmptyState } from '../../shared/ui';

type ModelCataloguePanelProps = {
  models: ModelRecord[];
  onProbeModel: (modelId: string) => void;
};

export function ModelCataloguePanel({ models, onProbeModel }: ModelCataloguePanelProps) {
  return (
    <section className="panel stack">
      <h2>Model catalogue</h2>
      {models.length === 0 ? (
        <EmptyState title="No model records" body="Register a model to make capability provenance visible." />
      ) : (
        <div className="list">
          {models.map((model) => (
            <article className="list-item" key={model.id}>
              <div>
                <strong>{model.model_identifier}</strong>
                <p className="muted">{model.provenance} · {model.verified ? 'verified' : 'unverified'}</p>
                <p className="muted">{model.capabilities.join(', ') || 'No capabilities recorded.'}</p>
                <small>{String(model.probe_result.source ?? 'No probe recorded')}</small>
              </div>
              <Button type="button" onClick={() => onProbeModel(model.id)}>Probe</Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
