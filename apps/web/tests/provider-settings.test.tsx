import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('ProviderSettings', () => {
  it('tests stored connections and renders model catalogue state', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) return jsonResponse([adapterSchema()]);
      if (url.includes('/providers/connections?')) return jsonResponse([providerConnection()]);
      if (url.includes('/providers/models?')) return jsonResponse([modelRecord({ capabilities: [], verified: false })]);
      if (url.includes('/providers/profiles?')) return jsonResponse([modelProfile({ explicit_pin: false })]);
      if (url.includes('/providers/connections/conn-1/test') && init?.method === 'POST') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': authState.csrfToken });
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect(await screen.findByText('No capabilities recorded.')).toBeInTheDocument();
    expect(screen.getByText(/fallback allowed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^test$/i }));
    expect(await screen.findByText('Stored connection test passed.')).toBeInTheDocument();
  });

  it('surfaces model, profile and stored-connection failures', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) return jsonResponse([adapterSchema()]);
      if (url.includes('/providers/connections?')) return jsonResponse([providerConnection()]);
      if (url.includes('/providers/models?')) {
        return jsonResponse([modelRecord(), modelRecord({ id: 'model-2', model_identifier: 'backup-reviewer' })]);
      }
      if (url.includes('/providers/profiles?')) return jsonResponse([modelProfile()]);
      if (url.includes('/providers/models') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          capabilities: ['text', 'json'],
          provenance: 'manual override'
        });
        return jsonResponse({ message: 'model denied' }, 422);
      }
      if (url.includes('/providers/profiles') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ model_record_id: 'model-2' });
        return jsonResponse({ message: 'profile denied' }, 409);
      }
      if (url.includes('/providers/connections/conn-1/test') && init?.method === 'POST') {
        return jsonResponse({ message: 'probe failed' }, 503);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect((await screen.findAllByText('fake-reviewer')).length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText(/capabilities/i));
    await user.type(screen.getByLabelText(/capabilities/i), 'text, json, ');
    await user.clear(screen.getByLabelText(/^provenance$/i));
    await user.type(screen.getByLabelText(/^provenance$/i), 'manual override');
    await user.selectOptions(screen.getByLabelText(/model record/i), 'model-2');
    fireEvent.submit(screen.getByLabelText(/model identifier/i).closest('form') as HTMLFormElement);
    fireEvent.submit(screen.getByLabelText(/profile name/i).closest('form') as HTMLFormElement);
    await user.click(screen.getByRole('button', { name: /register model/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('model denied');
    await user.click(screen.getByRole('button', { name: /assign profile/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('profile denied');
    await user.click(screen.getByRole('button', { name: /^test$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('probe failed');
  });

  it('surfaces adapter catalogue load failures', async () => {
    storeAuth();
    mockFetch((url) => {
      if (url.includes('/providers/adapters')) return jsonResponse({ message: 'adapter down' }, 503);
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect(await screen.findByRole('alert')).toHaveTextContent('adapter down');
  });

  it('surfaces workspace catalogue load failures', async () => {
    storeAuth();
    mockFetch((url) => {
      if (url.includes('/providers/adapters')) return jsonResponse([adapterSchema()]);
      if (url.includes('/providers/connections?')) return jsonResponse({ message: 'workspace denied' }, 403);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect(await screen.findByRole('alert')).toHaveTextContent('workspace denied');
  });
});

function adapterSchema() {
  return {
    key: 'fake',
    label: 'Deterministic fake provider',
    fields: [{ name: 'scenario', label: 'Scenario', secret: false, required: false, input_type: 'text' }],
    default_capabilities: ['text']
  };
}

function providerConnection() {
  return {
    id: 'conn-1',
    workspace_id: authState.workspaceId,
    adapter: 'fake',
    name: 'Fake local provider',
    config: {},
    has_credentials: false
  };
}

function modelRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    workspace_id: authState.workspaceId,
    provider_connection_id: 'conn-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text', 'structured_output'],
    provenance: 'manual',
    verified: true,
    ...overrides
  };
}

function modelProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    workspace_id: authState.workspaceId,
    name: 'Default evidence profile',
    agent_key: 'evidence_context',
    model_record_id: 'model-1',
    explicit_pin: true,
    ...overrides
  };
}
