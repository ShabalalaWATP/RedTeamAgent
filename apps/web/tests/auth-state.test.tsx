import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('stored auth state', () => {
  it('uses stored auth defaults and grants administrator access', async () => {
    sessionStorage.setItem('rta.auth', JSON.stringify({
      userId: authState.userId,
      email: 'member@example.com',
      workspaceId: authState.workspaceId,
      workspaceName: authState.workspaceName
    }));
    mockFetch((url) => {
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/workflows');
    expect(await screen.findByText('User')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
    cleanup();

    storeAuth({ workspaceRole: 'administrator', email: 'admin@example.com' });
    mockFetch((url) => {
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/workflows');
    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    cleanup();

    storeAuth({ accountType: 'owner', workspaceRole: 'owner', email: 'alexorr@yahoo.co.uk' });
    mockFetch((url) => {
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/workflows');
    expect(await screen.findByText('Owner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });
});
