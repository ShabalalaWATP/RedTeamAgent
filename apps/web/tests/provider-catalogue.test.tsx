import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModelDropdown } from '../src/features/providers/ModelDropdown';
import {
  adapterFieldHint,
  capabilitiesForModel,
  modelOptionKey,
  modelOptionsForConnection,
  modelOptionsForSchema,
  preferredModelIdentifier,
  schemaForConnection,
  type AdapterSchema
} from '../src/features/providers/providerCatalogue';
import type { ModelRecord, ProviderConnection } from '../src/shared/types';

describe('provider catalogue helpers', () => {
  it('renders selectable model options and empty states', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ModelDropdown
        value="gpt-5.5"
        options={[{ model_identifier: 'gpt-5.5' }, { model_identifier: 'gpt-5.4-mini' }]}
        onChange={onChange}
      />
    );
    await user.selectOptions(screen.getByRole('combobox'), 'gpt-5.4-mini');
    expect(onChange).toHaveBeenCalledWith('gpt-5.4-mini');

    render(<ModelDropdown value="" options={[]} onChange={vi.fn()} />);
    expect(screen.getByText('No models discovered')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[1]).toBeDisabled();
  });

  it('derives provider model options and field hints', () => {
    const schema = adapterSchema();
    const connection = providerConnection();
    const syncedModel = modelRecord();

    expect(adapterFieldHint({ name: 'api_key', label: 'API key', secret: true, required: true, input_type: 'password' }))
      .toMatch(/server-side/i);
    expect(adapterFieldHint({ name: 'endpoint_url', label: 'Endpoint', secret: false, required: true, input_type: 'url' }))
      .toMatch(/compatible or self-hosted/i);
    expect(adapterFieldHint({ name: 'scenario', label: 'Scenario', secret: false, required: false, input_type: 'text' }))
      .toBeUndefined();
    expect(modelOptionsForSchema(schema)).toHaveLength(1);
    expect(modelOptionsForSchema(undefined)).toHaveLength(0);
    expect(schemaForConnection([schema], connection)?.key).toBe('openai');
    expect(modelOptionsForConnection([schema], [], connection)[0].model_identifier).toBe('gpt-5.5');
    expect(modelOptionsForConnection([schema], [syncedModel], connection)[0].model_identifier).toBe('gpt-synced');
    expect(modelOptionKey(schema.catalogue_models ?? [])).toBe('gpt-5.5');
    expect(preferredModelIdentifier(schema.catalogue_models ?? [], 'gpt-5.5')).toBe('gpt-5.5');
    expect(preferredModelIdentifier(schema.catalogue_models ?? [], 'missing')).toBe('gpt-5.5');
    expect(preferredModelIdentifier([], 'missing')).toBe('');
    expect(capabilitiesForModel(schema.catalogue_models ?? [], 'gpt-5.5', ['fallback'])).toEqual(['text', 'streaming']);
    expect(capabilitiesForModel(schema.catalogue_models ?? [], 'missing', ['text'])).toEqual(['text']);
  });
});

function adapterSchema(): AdapterSchema {
  return {
    key: 'openai',
    label: 'OpenAI',
    fields: [],
    default_capabilities: ['text'],
    catalogue_models: [{ model_identifier: 'gpt-5.5', capabilities: ['text', 'streaming'] }]
  };
}

function providerConnection(): ProviderConnection {
  return {
    id: 'connection-1',
    workspace_id: 'workspace-1',
    adapter: 'openai',
    name: 'OpenAI',
    config: {},
    has_credentials: true
  };
}

function modelRecord(): ModelRecord {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'connection-1',
    model_identifier: 'gpt-synced',
    capabilities: ['text'],
    provenance: 'adapter_catalogue:openai',
    verified: false,
    probe_result: {}
  };
}
