import type { ModelProfile, ModelRecord, ProviderConnection } from '../../shared/types';
import { preferredModelIdentifier } from './providerCatalogue';
import type { AdapterSchema } from './providerCatalogue';

const HIDDEN_PROVIDER_KEYS = new Set(['fake']);
export const ACTIVE_REVIEW_AGENT_KEY = 'default';

export function visibleProviderSchemas(schemas: AdapterSchema[]) {
  return schemas.filter((item) => !HIDDEN_PROVIDER_KEYS.has(item.key));
}

export function visibleProviderConnections(connections: ProviderConnection[]) {
  return connections.filter((connection) => !HIDDEN_PROVIDER_KEYS.has(connection.adapter));
}

export function visibleProviderModels(models: ModelRecord[], connections: ProviderConnection[]) {
  const connectionIds = new Set(connections.map((connection) => connection.id));
  return models.filter((model) => connectionIds.has(model.provider_connection_id));
}

export function activeReviewModelId(profiles: ModelProfile[]) {
  return profiles.find((profile) => profile.agent_key === ACTIVE_REVIEW_AGENT_KEY)?.model_record_id ?? '';
}

export function modelCountLabel(count: number) {
  return `${count} model${count === 1 ? '' : 's'}`;
}

export function selectSyncedModel(models: ModelRecord[], preferredIdentifier: string) {
  const identifier = preferredModelIdentifier(
    models.map((model) => ({ model_identifier: model.model_identifier, capabilities: model.capabilities })),
    preferredIdentifier
  );
  return models.find((model) => model.model_identifier === identifier) ?? models[0] ?? null;
}

export function selectionResult(providerName: string, synced: ModelRecord[], probed: ModelRecord | null) {
  const label = providerName.trim() || 'Provider';
  if (synced.length === 0) return `${label} returned no models, so nothing was selected.`;
  if (!probed) return `${label} returned ${modelCountLabel(synced.length)}, but no review model was selected.`;
  if (!probed.verified) return `${label} / ${probed.model_identifier} could not be verified, so it was not selected.`;
  return `Selected and tested: ${label} / ${probed.model_identifier}.`;
}
