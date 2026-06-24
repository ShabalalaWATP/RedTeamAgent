import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('admin settings route', () => {
  it('renders AI providers and workspace administration as one admin view', async () => {
    storeAuth();
    mockSettingsEndpoints();
    renderApp('/settings');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI providers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace administration' })).toBeInTheDocument();
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

function mockSettingsEndpoints() {
  mockFetch((url) => {
    const path = new URL(url).pathname;
    if (path === '/providers/adapters') {
      return jsonResponse([{ key: 'fake', label: 'Fake', fields: [], default_capabilities: ['text'] }]);
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
