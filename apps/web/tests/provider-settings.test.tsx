import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/app/AuthContext';
import { EvaluationPanel } from '../src/features/providers/EvaluationPanel';
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
      if (url.includes('/providers/connections/conn-1/models/sync') && init?.method === 'POST') {
        return jsonResponse([modelRecord({ provenance: 'adapter_catalogue:fake' })]);
      }
      if (url.includes('/providers/models/model-1/probe') && init?.method === 'POST') {
        return jsonResponse(modelRecord({ probe_result: { ok: true, source: 'deterministic_fake_probe' } }));
      }
      if (url.includes('/evaluations/stage2') && init?.method === 'POST') {
        return jsonResponse({
          workspace_id: authState.workspaceId,
          fixture_count: 10,
          metrics: { routing_precision: 0.91, citation_validity: 0.94 },
          adversarial_fixtures: ['malicious website instruction override'],
          live_smoke_tests: 'disabled'
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect(await screen.findByText('No capabilities recorded.')).toBeInTheDocument();
    expect(screen.getByText(/fallback allowed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^test$/i }));
    expect(await screen.findByText('Stored connection test passed.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sync catalogue/i }));
    expect(await screen.findByText('Model catalogue synced with 1 record.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /probe/i }));
    expect(await screen.findByText(/capability probe passed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run stage 2 evaluation/i }));
    expect(await screen.findByText('10 fixtures')).toBeInTheDocument();
    expect(screen.getByText('Routing Precision')).toBeInTheDocument();
    expect(screen.getByText('malicious website instruction override')).toBeInTheDocument();
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
      if (url.includes('/providers/connections/conn-1/models/sync') && init?.method === 'POST') {
        return jsonResponse({ message: 'sync denied' }, 502);
      }
      if (url.includes('/providers/models/model-1/probe') && init?.method === 'POST') {
        return jsonResponse({ message: 'model probe denied' }, 418);
      }
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
      if (url.includes('/evaluations/stage2') && init?.method === 'POST') {
        return jsonResponse({ message: 'evaluation denied' }, 409);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/providers');

    expect((await screen.findAllByText('fake-reviewer')).length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText(/capabilities/i));
    await user.type(screen.getByLabelText(/capabilities/i), 'text, json, ');
    await user.clear(screen.getByLabelText(/^provenance$/i));
    await user.type(screen.getByLabelText(/^provenance$/i), 'manual override');
    await user.selectOptions(screen.getByLabelText(/provider connection/i), 'conn-1');
    await user.selectOptions(screen.getByLabelText(/model record/i), 'model-2');
    fireEvent.submit(screen.getByLabelText(/model identifier/i).closest('form') as HTMLFormElement);
    fireEvent.submit(screen.getByLabelText(/profile name/i).closest('form') as HTMLFormElement);
    await user.click(screen.getByRole('button', { name: /register model/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('model denied');
    await user.click(screen.getByRole('button', { name: /assign profile/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('profile denied');
    await user.click(screen.getByRole('button', { name: /^test$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('probe failed');
    await user.click(screen.getByRole('button', { name: /sync catalogue/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sync denied');
    await user.click(screen.getAllByRole('button', { name: /probe/i })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('model probe denied');
    await user.click(screen.getByRole('button', { name: /run stage 2 evaluation/i }));
    expect(await screen.findByText('evaluation denied')).toBeInTheDocument();
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

  it('keeps unauthenticated evaluation actions local', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ message: 'unexpected' }, 500));
    render(
      <AuthProvider>
        <EvaluationPanel />
      </AuthProvider>
    );

    const button = screen.getByRole('button', { name: /run stage 2 evaluation/i }) as HTMLButtonElement;
    button.disabled = false;
    fireEvent.click(button);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows evaluation running state while metrics load', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('rta.auth', JSON.stringify(authState));
    let resolveEvaluation: (value: Response) => void = () => undefined;
    mockFetch((url) => {
      if (url.includes('/evaluations/stage2')) {
        return new Promise<Response>((resolve) => {
          resolveEvaluation = resolve;
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    render(
      <AuthProvider>
        <EvaluationPanel />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /run stage 2 evaluation/i }));
    expect(screen.getByRole('button', { name: /running evaluation/i })).toBeDisabled();
    resolveEvaluation(jsonResponse({
      workspace_id: authState.workspaceId,
      fixture_count: 10,
      metrics: { routing_recall: 0.9 },
      adversarial_fixtures: [],
      live_smoke_tests: 'disabled'
    }));
    expect(await screen.findByText('Routing Recall')).toBeInTheDocument();
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
    probe_result: { ok: true, source: 'manual' },
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
