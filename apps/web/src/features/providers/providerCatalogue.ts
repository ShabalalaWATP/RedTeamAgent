import type { ModelRecord, ProviderConnection } from '../../shared/types';

export type AdapterField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  input_type: string;
};

export type CatalogueModel = {
  model_identifier: string;
  capabilities?: string[];
};

export type AdapterSchema = {
  key: string;
  label: string;
  fields: AdapterField[];
  default_capabilities: string[];
  catalogue_models?: CatalogueModel[];
};

export function adapterFieldHint(field: AdapterField) {
  if (field.secret) return 'Stored server-side only. The browser never receives it back.';
  if (field.input_type === 'url' || field.name.includes('url') || field.name.includes('endpoint')) {
    return 'Only needed for compatible or self-hosted providers.';
  }
  return undefined;
}

export function modelOptionsForSchema(schema: AdapterSchema | undefined) {
  return schema?.catalogue_models?.length ? schema.catalogue_models : [];
}

export function modelOptionsForSetup(schema: AdapterSchema | undefined, liveModels: CatalogueModel[]) {
  if (liveModels.length > 0) return liveModels;
  if (schema?.fields.some((field) => field.secret && field.required)) return [];
  return modelOptionsForSchema(schema);
}

export function modelOptionKey(options: CatalogueModel[]) {
  return options.map((model) => model.model_identifier).join('|');
}

export function preferredModelIdentifier(options: CatalogueModel[], current: string) {
  if (options.some((model) => model.model_identifier === current)) return current;
  return options[0]?.model_identifier ?? '';
}

export function schemaForConnection(schemas: AdapterSchema[], connection: ProviderConnection | undefined) {
  return schemas.find((item) => item.key === connection?.adapter);
}

export function modelOptionsForConnection(
  schemas: AdapterSchema[],
  models: ModelRecord[],
  connection: ProviderConnection | undefined
) {
  const synced = models
    .filter((model) => model.provider_connection_id === connection?.id)
    .map((model) => ({ model_identifier: model.model_identifier, capabilities: model.capabilities }));
  return synced.length ? synced : modelOptionsForSchema(schemaForConnection(schemas, connection));
}

export function capabilitiesForModel(options: CatalogueModel[], modelIdentifier: string, fallback: string[]) {
  return options.find((model) => model.model_identifier === modelIdentifier)?.capabilities ?? fallback;
}
