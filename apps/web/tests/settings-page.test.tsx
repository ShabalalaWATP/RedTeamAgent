import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('admin settings route', () => {
  it('renders AI provider setup and collapsed admin controls as one admin view', async () => {
    storeAuth();
    mockSettingsEndpoints();
    renderApp('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account security/i })).toBeInTheDocument();
    expect(screen.getByText(/two-factor authentication is optional/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI setup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/ai provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByText(/not a url/i)).toBeInTheDocument();
    expect(screen.getByText('Advanced AI controls')).toBeInTheDocument();
    expect(screen.queryByText('Workspace administration')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /providers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /enterprise/i })).not.toBeInTheDocument();
  });

  it('redirects retired admin URLs into settings', async () => {
    for (const path of ['/providers', '/enterprise']) {
      storeAuth();
      mockSettingsEndpoints();
      renderApp(path);
      expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      cleanup();
    }
  });

  it('sets up optional two-factor authentication from settings', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up 2fa/i }));
    expect(await screen.findByLabelText(/authenticator uri/i)).toHaveValue('otpauth://totp/test');
    expect(screen.getByText('aaaa-bbbb')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator code/i), '123456');
    await user.click(screen.getByRole('button', { name: /enable 2fa/i }));
    expect(await screen.findByText(/two-factor authentication enabled/i)).toBeInTheDocument();
  });

  it('disables two-factor authentication from settings', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ mfaEnabled: true });
    renderApp('/settings');

    expect(await screen.findByText(/two-factor authentication is enabled/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator or recovery code/i), '123456');
    await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
    expect(await screen.findByText(/two-factor authentication disabled/i)).toBeInTheDocument();
  });

  it('surfaces two-factor setup and enable errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ setupError: true });
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up 2fa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('setup failed');

    cleanup();
    storeAuth();
    mockSettingsEndpoints({ enableError: true });
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up 2fa/i }));
    await user.type(await screen.findByLabelText(/authenticator code/i), '123456');
    await user.click(screen.getByRole('button', { name: /enable 2fa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('enable failed');
  });

  it('surfaces two-factor disable errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ mfaEnabled: true, disableError: true });
    renderApp('/settings');

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), '123456');
    await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('disable failed');
  });

  it('sends unauthenticated settings access to login', async () => {
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'RedTeamAgent' })).toBeInTheDocument();
  });

  it('treats incomplete stored auth as signed out', async () => {
    sessionStorage.setItem('rta.auth', JSON.stringify({ email: 'partial@example.com' }));
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'RedTeamAgent' })).toBeInTheDocument();
  });
});

function mockSettingsEndpoints(
  options: { mfaEnabled?: boolean; setupError?: boolean; enableError?: boolean; disableError?: boolean } = {}
) {
  mockFetch((url) => {
    const path = new URL(url).pathname;
    if (path === '/auth/mfa/status') return jsonResponse({ enabled: Boolean(options.mfaEnabled) });
    if (path === '/auth/mfa/setup') {
      if (options.setupError) return jsonResponse({ message: 'setup failed' }, 500);
      return jsonResponse({
        enabled: false,
        secret: 'JBSWY3DPEHPK3PXP',
        provisioning_uri: 'otpauth://totp/test',
        recovery_codes: ['aaaa-bbbb', 'cccc-dddd']
      });
    }
    if (path === '/auth/mfa/enable') {
      return options.enableError ? jsonResponse({ message: 'enable failed' }, 401) : jsonResponse(null, 204);
    }
    if (path === '/auth/mfa/disable') {
      return options.disableError ? jsonResponse({ message: 'disable failed' }, 401) : jsonResponse(null, 204);
    }
    if (path === '/providers/adapters') {
      return jsonResponse([
        {
          key: 'fake',
          label: 'Fake',
          fields: [],
          default_capabilities: ['text'],
          catalogue_models: [{ model_identifier: 'fake-reviewer', capabilities: ['text'] }]
        }
      ]);
    }
    if (path === '/providers/connections') return jsonResponse([]);
    if (path === '/providers/models') return jsonResponse([]);
    if (path === '/providers/profiles') return jsonResponse([]);
    if (path.endsWith('/governance')) return jsonResponse(governance());
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
    return jsonResponse({ message: 'unexpected' }, 500);
  });
}

function governance() {
  return {
    workspace_id: authState.workspaceId,
    provider_allowlist: [],
    model_allowlist: [],
    data_classification_allowlist: [],
    region_allowlist: [],
    purpose_allowlist: [],
    approved_domains: [],
    retention_days: 365,
    preserve_historical_reports: true,
    legal_hold: false,
    mfa_required: false,
    sso_provider: null,
    custom_branding: {},
    updated_at: '2026-06-24T12:00:00Z'
  };
}
