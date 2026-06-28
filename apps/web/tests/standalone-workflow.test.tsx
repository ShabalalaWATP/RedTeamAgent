import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('standalone workflow start', () => {
  it('starts a workflow without requiring a project first', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.includes('/usage/limits')) return jsonResponse(usageLimits());
      if (url.endsWith('/reviews') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ workspace_id: authState.workspaceId });
        return jsonResponse(reviewResponse());
      }
      if (url.includes('/reviews/review-standalone/sources/text')) {
        return jsonResponse({
          id: 'source-1',
          filename: 'proposal.md',
          content_type: 'text/markdown',
          state: 'ingested',
          metadata: {},
          warnings: []
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/workflows');
    await user.click(await screen.findByRole('button', { name: /start workflow/i }));
    expect(await screen.findByRole('heading', { name: 'New review' })).toBeInTheDocument();
    expect(screen.getByText('Standalone workflow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next stage/i }));
    await user.click(screen.getByRole('button', { name: /add pasted text/i }));
    expect(await screen.findByText('Review created')).toBeInTheDocument();
  });

  it('does not fetch projects when starting a standalone workflow', async () => {
    storeAuth();
    const user = userEvent.setup();
    const requests: string[] = [];
    mockFetch((url, init) => {
      requests.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.includes('/usage/limits')) return jsonResponse(usageLimits());
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/workflows');
    await user.click(await screen.findByRole('button', { name: /start workflow/i }));
    expect(await screen.findByRole('heading', { name: 'New review' })).toBeInTheDocument();
    expect(requests.some((request) => request.includes('/projects'))).toBe(false);
  });
});

function reviewResponse() {
  return {
    id: 'review-standalone',
    workspace_id: authState.workspaceId,
    project_id: null,
    title: 'Decision readiness review',
    proposal_text: 'proposal',
    mode: 'standard',
    focus_chips: ['security']
  };
}

function usageLimits() {
  return {
    account_type: 'user',
    tier_name: 'User',
    project_limit: 5,
    projects_used: 0,
    projects_remaining: 5,
    workflow_total_limit: 20,
    workflows_used: 0,
    workflows_remaining: 20,
    workflow_weekly_limit: 10,
    workflows_started_this_week: 0,
    weekly_workflows_remaining: 10,
    daily_review_run_limit: 10,
    runs_started_today: 0,
    runs_remaining_today: 10,
    resets_at: '2026-06-25T00:00:00Z'
  };
}
