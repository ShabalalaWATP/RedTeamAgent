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
    expect(screen.getByText(/authenticator-app mfa and passkeys are available/i)).toBeInTheDocument();
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

  it('sets up optional MFA from settings', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints();
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up authenticator app/i }));
    expect(await screen.findByText('aaaa-bbbb')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator code/i), '123456');
    await user.click(screen.getByRole('button', { name: /enable mfa/i }));
    expect(await screen.findByText(/authenticator-app mfa enabled/i)).toBeInTheDocument();
  });

  it('lets site owners manage users and review visit metadata', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    const user = userEvent.setup();
    mockSettingsEndpoints({ siteAdmin: true });
    renderApp('/settings');

    expect(await screen.findByRole('heading', { name: /site administration/i })).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText(/3 runs/i)).toBeInTheDocument();
    expect(screen.getByText('203.0.113.9')).toBeInTheDocument();
    expect(screen.queryByText(/secret project content/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getAllByLabelText(/account status/i)[1], 'suspended');
    await user.type(screen.getAllByLabelText(/login message/i)[1], 'Manual review required.');
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[1]);

    expect(await screen.findByText(/account updated/i)).toBeInTheDocument();
  });

  it('lets owners assign scoped admins', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    const user = userEvent.setup();
    mockSettingsEndpoints({ siteAdmin: true, extraUsers: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    await user.selectOptions(screen.getAllByLabelText(/account type/i)[0], 'admin');
    await user.selectOptions(screen.getByLabelText(/admin scope/i), 'selected');
    const managedUser = screen.getByRole('checkbox', { name: /secondary@example.com/i });
    await user.click(managedUser);
    expect(managedUser).toBeChecked();
    await user.click(managedUser);
    expect(managedUser).not.toBeChecked();
    await user.click(managedUser);
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[1]);

    expect(await screen.findByText(/account updated/i)).toBeInTheDocument();
  });

  it('lets scoped admins manage assigned users without role controls', async () => {
    storeAuth({ accountType: 'admin', userId: 'admin-1' });
    const user = userEvent.setup();
    mockSettingsEndpoints({ siteAdmin: true, scopedAdmin: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText(/account type/i)).not.toBeInTheDocument();
    expect(screen.getByText(/anonymous/i)).toBeInTheDocument();
    expect(screen.getByText(/registered user/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));
    await user.click(screen.getByRole('button', { name: /^suspend$/i }));
    expect(await screen.findByText(/account updated/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^ban$/i }));
    expect(await screen.findByText(/account updated/i)).toBeInTheDocument();
  });

  it('lets owners delete regular users', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    const user = userEvent.setup();
    mockSettingsEndpoints({ siteAdmin: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    expect(await screen.findByText(/account deleted/i)).toBeInTheDocument();
  });

  it('surfaces site-admin save and delete failures', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    const user = userEvent.setup();
    mockSettingsEndpoints({ siteAdmin: true, saveUserError: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[1]);
    expect(await screen.findByRole('alert')).toHaveTextContent('save failed');

    cleanup();
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    mockSettingsEndpoints({ siteAdmin: true, deleteUserError: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('delete failed');
  });

  it('handles site-admin empty states and load failures', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    mockSettingsEndpoints({ siteAdmin: true, emptySiteAdmin: true });
    renderApp('/settings');

    expect(await screen.findByText(/no users visible/i)).toBeInTheDocument();
    expect(screen.getByText(/no visits recorded yet/i)).toBeInTheDocument();

    cleanup();
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    mockSettingsEndpoints({ siteAdminError: true });
    renderApp('/settings');
    expect(await screen.findByRole('alert')).toHaveTextContent('site admin failed');
  });

  it('shows sparse user metadata without exposing user content', async () => {
    storeAuth({ accountType: 'owner', userId: 'owner-1' });
    mockSettingsEndpoints({ siteAdmin: true, sparseUser: true });
    renderApp('/settings');

    expect(await screen.findByText('member@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/never · no IP/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/secret project content/i)).not.toBeInTheDocument();
  });

  it('disables optional MFA from settings', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ mfaEnabled: true });
    renderApp('/settings');

    expect(await screen.findByText(/^enabled$/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator or recovery code/i), '123456');
    await user.click(screen.getByRole('button', { name: /disable mfa/i }));
    expect(await screen.findByText(/authenticator-app mfa disabled/i)).toBeInTheDocument();
  });

  it('surfaces MFA setup and enable errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ setupError: true });
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up authenticator app/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('setup failed');

    cleanup();
    storeAuth();
    mockSettingsEndpoints({ enableError: true });
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /set up authenticator app/i }));
    await user.type(await screen.findByLabelText(/authenticator code/i), '123456');
    await user.click(screen.getByRole('button', { name: /enable mfa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('enable failed');
  });

  it('surfaces MFA disable errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockSettingsEndpoints({ mfaEnabled: true, disableError: true });
    renderApp('/settings');

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), '123456');
    await user.click(screen.getByRole('button', { name: /disable mfa/i }));
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
  options: {
    mfaEnabled?: boolean;
    setupError?: boolean;
    enableError?: boolean;
    disableError?: boolean;
    siteAdmin?: boolean;
    siteAdminError?: boolean;
    emptySiteAdmin?: boolean;
    extraUsers?: boolean;
    scopedAdmin?: boolean;
    saveUserError?: boolean;
    deleteUserError?: boolean;
    sparseUser?: boolean;
  } = {}
) {
  mockFetch((url, init) => {
    const path = new URL(url).pathname;
    if (path === '/auth/mfa/status') return jsonResponse({ enabled: Boolean(options.mfaEnabled), required: false });
    if (path === '/auth/passkeys/status') return jsonResponse({
      required: false, authenticator_app_enabled: Boolean(options.mfaEnabled), passkey_registered: false,
      passkey_verified: false, setup_required: false, passkey_verification_required: false, registered: false, count: 0,
      credentials: []
    });
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
    if (path.startsWith('/site-admin/') && options.siteAdminError) {
      return jsonResponse({ message: 'site admin failed' }, 500);
    }
    if (path === '/site-admin/users' && options.siteAdmin) {
      if (options.emptySiteAdmin) return jsonResponse([]);
      if (options.scopedAdmin) {
        return jsonResponse([siteUser({ id: 'user-1', email: 'member@example.com', run_count: 3 })]);
      }
      return jsonResponse([
        siteUser({ id: 'owner-1', email: 'owner@example.com', account_type: 'owner' }),
        siteUser({
          id: 'user-1',
          email: 'member@example.com',
          run_count: 3,
          last_login_at: options.sparseUser ? null : '2026-06-27T00:00:00Z',
          last_login_ip: options.sparseUser ? null : '203.0.113.9',
          last_seen_at: options.sparseUser ? null : '2026-06-27T00:00:00Z',
          last_seen_ip: options.sparseUser ? null : '203.0.113.9'
        }),
        ...(options.extraUsers ? [siteUser({ id: 'user-2', email: 'secondary@example.com' })] : [])
      ]);
    }
    if (path === '/site-admin/visits' && options.siteAdmin) {
      if (options.emptySiteAdmin) return jsonResponse([]);
      if (options.scopedAdmin) {
        return jsonResponse([
          siteVisit({ id: 'visit-2', user_id: null, ip_address: '198.51.100.1' }),
          siteVisit({ id: 'visit-3', user_id: 'missing-user', ip_address: '198.51.100.2', path: '/settings' })
        ]);
      }
      return jsonResponse([siteVisit({ method: 'POST', ip_address: '203.0.113.9' })]);
    }
    if (path === '/site-admin/users/user-1' && options.siteAdmin && init?.method === 'PUT') {
      if (options.saveUserError) return jsonResponse({ message: 'save failed' }, 500);
      return jsonResponse(siteUser({
        id: 'user-1',
        email: 'member@example.com',
        account_type: options.extraUsers ? 'admin' : 'user',
        account_status: options.extraUsers ? 'active' : 'suspended',
        status_message: 'Manual review required.',
        admin_scope: options.extraUsers ? 'selected' : 'none',
        admin_managed_user_ids: options.extraUsers ? ['user-2'] : [],
        run_count: 3,
        last_login_ip: '203.0.113.9'
      }));
    }
    if (path === '/site-admin/users/user-1' && options.siteAdmin && init?.method === 'DELETE') {
      if (options.deleteUserError) return jsonResponse({ message: 'delete failed' }, 500);
      return jsonResponse(siteUser({ id: 'user-1', email: 'member@example.com', account_status: 'deleted' }));
    }
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

function siteUser(overrides: Record<string, unknown>) {
  return {
    id: 'user-1',
    email: 'member@example.com',
    is_verified: true,
    account_type: 'user',
    account_status: 'active',
    status_message: '',
    admin_scope: 'none',
    admin_managed_user_ids: [],
    created_at: '2026-06-27T00:00:00Z',
    last_login_at: '2026-06-27T00:00:00Z',
    last_login_ip: null,
    last_seen_at: '2026-06-27T00:00:00Z',
    last_seen_ip: '203.0.113.9',
    run_count: 0,
    ...overrides
  };
}

function siteVisit(overrides: Record<string, unknown>) {
  return {
    id: 'visit-1',
    user_id: 'user-1',
    ip_address: '203.0.113.9',
    method: 'GET',
    path: '/auth',
    user_agent: 'browser',
    created_at: '2026-06-27T00:00:00Z',
    ...overrides
  };
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
