import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../src/app/AuthContext';
import { EnterprisePage } from '../src/features/enterprise/EnterprisePage';
import { authState, jsonResponse, mockFetch, renderWithRouter, storeAuth } from './test-utils';

const governance = {
  workspace_id: authState.workspaceId,
  provider_allowlist: ['fake'],
  model_allowlist: ['fake-reviewer'],
  data_classification_allowlist: [],
  region_allowlist: [],
  purpose_allowlist: [],
  approved_domains: ['example.com'],
  retention_days: 365,
  preserve_historical_reports: true,
  legal_hold: false,
  mfa_required: true,
  sso_provider: 'saml-ready',
  custom_branding: {},
  updated_at: '2026-06-24T12:00:00Z'
};

describe('EnterprisePage', () => {
  it('manages governance, members, integrations and retention', async () => {
    storeAuth();
    const calls: string[] = [];
    mockFetch((url, init) => {
      const path = new URL(url).pathname;
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.endsWith('/governance')) return jsonResponse(governance);
      if (path.endsWith('/members')) {
        return jsonResponse([{ workspace_id: authState.workspaceId, user_id: 'user-1', email: authState.email, role: 'owner' }]);
      }
      if (path.endsWith('/audit')) {
        return jsonResponse([{ id: 'audit-1', workspace_id: authState.workspaceId, actor_user_id: 'user-1', action: 'enterprise.governance_updated', metadata: {}, created_at: governance.updated_at }]);
      }
      if (path.endsWith('/notifications')) {
        return jsonResponse([{ id: 'note-1', workspace_id: authState.workspaceId, user_id: null, kind: 'assigned_action', title: 'Assign owner', body: '', read: false, created_at: governance.updated_at }]);
      }
      if (path.endsWith('/operations')) {
        return jsonResponse({
          run_volume: 4,
          failure_rate: 0.25,
          security_events: 1,
          queue_depth: 0,
          tracing_redaction: 'enabled',
          quotas: { workspace_runs_per_hour: 20 },
          backup_restore: { rto_hours: 4, rpo_hours: 24 }
        });
      }
      if (path.endsWith('/model-comparison')) {
        return jsonResponse({
          workspace_id: authState.workspaceId,
          models: [{ model_identifier: 'fake-reviewer', quality: 0.9, cost: 0, latency_ms: 120, failure_rate: 0.01, capability_coverage: 4 }]
        });
      }
      if (path.endsWith('/invitations')) return jsonResponse({ id: 'invite-1', ...governance, email: 'new.member@example.com', role: 'member', expires_at: governance.updated_at });
      if (path.endsWith('/custom-agents')) return jsonResponse({ id: 'agent-1', workspace_id: authState.workspaceId });
      if (path.endsWith('/api-tokens')) {
        return jsonResponse({ id: 'token-1', workspace_id: authState.workspaceId, name: 'Automation', token_prefix: 'rta_abc', scopes: ['reviews:read'], rate_limit_per_minute: 60, revoked: false, plain_token: 'rta_secret' });
      }
      if (path.endsWith('/webhooks')) {
        return jsonResponse({ id: 'hook-1', workspace_id: authState.workspaceId, name: 'Operations webhook', url: 'https://hooks.example/redteam', events: ['run.completed'], enabled: true, signing_secret: 'secret' });
      }
      if (path.endsWith('/retention/enforce')) return jsonResponse({ removed_notifications: 1 });
      return jsonResponse({}, 404);
    });

    renderEnterprisePage();
    expect(await screen.findByRole('heading', { name: 'Workspace administration' })).toBeInTheDocument();
    expect(screen.getByText(`${authState.email} · owner`)).toBeInTheDocument();
    expect(screen.getByText('assigned_action: Assign owner')).toBeInTheDocument();
    expect(screen.getAllByText('fake-reviewer').length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('SSO provider'));
    await user.type(screen.getByLabelText('SSO provider'), 'oidc-ready');
    await user.clear(screen.getByLabelText('Retention days'));
    await user.type(screen.getByLabelText('Retention days'), '90');
    await user.click(screen.getByLabelText('MFA required'));
    await user.click(screen.getByLabelText('Legal hold'));
    await user.clear(screen.getByLabelText('Provider allow-list'));
    await user.type(screen.getByLabelText('Provider allow-list'), 'fake, openai, ,');
    await user.clear(screen.getByLabelText('Model allow-list'));
    await user.type(screen.getByLabelText('Model allow-list'), 'fake-reviewer, fake-local, ,');
    await user.clear(screen.getByLabelText('Approved research domains'));
    await user.type(screen.getByLabelText('Approved research domains'), 'example.com, evidence.example, ,');
    await user.click(screen.getByRole('button', { name: /save governance/i }));
    expect(await screen.findByText('Governance policy saved.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Invite email'));
    await user.type(screen.getByLabelText('Invite email'), 'analyst@example.com');
    await user.selectOptions(screen.getByLabelText('Role'), 'administrator');
    await user.click(screen.getByRole('button', { name: /invite/i }));
    expect(await screen.findByText('Invitation created for analyst@example.com.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Custom agent name'));
    await user.type(screen.getByLabelText('Custom agent name'), 'Procurement reviewer');
    await user.clear(screen.getByLabelText('Custom agent instructions'));
    await user.type(screen.getByLabelText('Custom agent instructions'), 'Return structured procurement risks.');
    await user.click(screen.getByRole('button', { name: /create agent/i }));
    expect(await screen.findByText('Custom agent submitted for governed use.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('API token name'));
    await user.type(screen.getByLabelText('API token name'), 'Ops automation');
    await user.click(screen.getByRole('button', { name: /create token/i }));
    expect(await screen.findByText(/Token rta_abc created/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Webhook URL'));
    await user.type(screen.getByLabelText('Webhook URL'), 'https://hooks.example/ops');
    await user.click(screen.getByRole('button', { name: /create webhook/i }));
    expect(await screen.findByText('Webhook Operations webhook created.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run retention/i }));
    expect(await screen.findByText('Retention removed 1 notification records.')).toBeInTheDocument();

    await waitFor(() => expect(calls).toContain(`PUT /enterprise/workspaces/${authState.workspaceId}/governance`));
    expect(calls).toContain(`POST /enterprise/workspaces/${authState.workspaceId}/api-tokens`);
    expect(calls).toContain(`POST /enterprise/workspaces/${authState.workspaceId}/webhooks`);
  }, 12_000);

  it('renders optional security and empty enterprise states', async () => {
    storeAuth();
    const optionalGovernance = { ...governance, mfa_required: false, sso_provider: null, model_allowlist: [] };
    mockFetch((url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/governance')) return jsonResponse(optionalGovernance);
      if (path.endsWith('/members')) return jsonResponse([]);
      if (path.endsWith('/audit')) return jsonResponse([]);
      if (path.endsWith('/notifications')) return jsonResponse([]);
      if (path.endsWith('/operations')) {
        return jsonResponse({
          run_volume: 0,
          failure_rate: 0,
          security_events: 0,
          queue_depth: 0,
          tracing_redaction: 'enabled',
          quotas: {},
          backup_restore: {}
        });
      }
      if (path.endsWith('/model-comparison')) return jsonResponse({ workspace_id: authState.workspaceId, models: [] });
      return jsonResponse({}, 404);
    });

    renderEnterprisePage();
    expect(await screen.findByText('MFA optional')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('').length).toBeGreaterThan(0);
    expect(screen.getByText('No members found.')).toBeInTheDocument();
    expect(screen.getByText('No workspace notifications.')).toBeInTheDocument();
    expect(screen.getByText('No audit events.')).toBeInTheDocument();
    expect(screen.getByText('No governed model records are available.')).toBeInTheDocument();
  });

  it('shows API errors from enterprise mutations', async () => {
    storeAuth();
    mockFetch((url, init) => {
      const path = new URL(url).pathname;
      if (init?.method && init.method !== 'GET') return jsonResponse({ message: 'Enterprise mutation failed' }, 500);
      if (path.endsWith('/governance')) return jsonResponse(governance);
      if (path.endsWith('/members')) return jsonResponse([]);
      if (path.endsWith('/audit')) return jsonResponse([]);
      if (path.endsWith('/notifications')) return jsonResponse([]);
      if (path.endsWith('/operations')) {
        return jsonResponse({
          run_volume: 0,
          failure_rate: 0,
          security_events: 0,
          queue_depth: 0,
          tracing_redaction: 'enabled',
          quotas: {},
          backup_restore: {}
        });
      }
      if (path.endsWith('/model-comparison')) return jsonResponse({ workspace_id: authState.workspaceId, models: [] });
      return jsonResponse({}, 404);
    });

    renderEnterprisePage();
    await screen.findByRole('heading', { name: 'Workspace administration' });
    const user = userEvent.setup();
    for (const name of ['Save governance', 'Invite', 'Create agent', 'Create token', 'Create webhook', 'Run retention']) {
      await user.click(screen.getByRole('button', { name }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Enterprise mutation failed');
    }
  }, 10_000);

  it('keeps enterprise actions inert without an auth context', async () => {
    sessionStorage.clear();
    renderWithRouter(
      <AuthProvider>
        <EnterprisePage />
      </AuthProvider>,
      '/enterprise'
    );
    expect(await screen.findByRole('heading', { name: 'Workspace administration' })).toBeInTheDocument();
    const user = userEvent.setup();
    for (const name of ['Save governance', 'Invite', 'Create agent', 'Create token', 'Create webhook', 'Run retention']) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

function renderEnterprisePage() {
  renderWithRouter(
    <AuthProvider>
      <EnterprisePage />
    </AuthProvider>,
    '/settings'
  );
}
