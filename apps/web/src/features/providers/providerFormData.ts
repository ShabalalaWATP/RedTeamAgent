import type { AdapterSchema } from './providerCatalogue';

export function providerCredentials(schema: AdapterSchema, values: Record<string, string>) {
  return Object.fromEntries(
    schema.fields.filter((field) => field.secret).map((field) => [field.name, values[field.name] ?? ''])
  );
}

export function providerConfig(
  schema: AdapterSchema,
  values: Record<string, string>,
  modelIdentifier = '',
  liveCatalogue = false
) {
  const config: Record<string, string | boolean> = Object.fromEntries(
    schema.fields.filter((field) => !field.secret).map((field) => [field.name, values[field.name] ?? ''])
  );
  if (modelIdentifier) config.model_identifier = modelIdentifier;
  if (liveCatalogue) config.live_catalogue = true;
  return config;
}
