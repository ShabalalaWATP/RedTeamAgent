import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedConnectionsPanel } from '../src/features/providers/SavedConnectionsPanel';
import { selectionResult } from '../src/features/providers/providerSelection';
import type { ModelRecord, ProviderConnection } from '../src/shared/types';

describe('SavedConnectionsPanel', () => {
  it('renders selected, tested and credential states per saved provider', () => {
    render(
      <SavedConnectionsPanel
        connections={[
          connection({ id: 'conn-1', has_credentials: false }),
          connection({ id: 'conn-2', name: 'Backup provider', has_credentials: true })
        ]}
        models={[
          model({ provider_connection_id: 'conn-1', verified: true }),
          model({ id: 'model-2', provider_connection_id: 'conn-2', model_identifier: 'gpt-4.1', verified: false })
        ]}
        activeModelId="model-1"
        result=""
        onTest={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('Current review model')).toBeInTheDocument();
    expect(screen.getByText('Production provider / gpt-4.1-mini')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/used for all users in this workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/only be needed when rotating keys or changing models/i)).toBeInTheDocument();
    expect(screen.getByText('Needs selection')).toBeInTheDocument();
    expect(screen.getByText('Needs test')).toBeInTheDocument();
    expect(screen.getByText('Tested')).toBeInTheDocument();
    expect(screen.getByText(/credentials not required/i)).toBeInTheDocument();
    expect(screen.getByText(/credentials stored/i)).toBeInTheDocument();
  });

  it('describes synced models that could not be probed', () => {
    expect(selectionResult(' ', [model()], null)).toBe(
      'Provider returned 1 model, but no review model was selected.'
    );
  });

  it('shows action required when no workspace review model is selected', () => {
    render(
      <SavedConnectionsPanel
        connections={[connection()]}
        models={[model()]}
        activeModelId=""
        result=""
        onTest={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('No workspace review model is selected yet.')).toBeInTheDocument();
    expect(screen.getByText('Action required')).toBeInTheDocument();
    expect(screen.getByText(/owner must select and test one model/i)).toBeInTheDocument();
  });
});

function connection(overrides: Partial<ProviderConnection> = {}): ProviderConnection {
  return {
    id: 'conn-1',
    workspace_id: 'workspace-1',
    adapter: 'openai',
    name: 'Production provider',
    config: {},
    has_credentials: true,
    ...overrides
  };
}

function model(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'conn-1',
    model_identifier: 'gpt-4.1-mini',
    capabilities: ['text'],
    provenance: 'manual',
    verified: true,
    probe_result: {},
    ...overrides
  };
}
