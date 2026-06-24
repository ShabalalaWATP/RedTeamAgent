import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth, textResponse } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('RedTeamAgent app flows', () => {
  it('registers, verifies and logs in with cookie auth metadata', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/register')) {
        return jsonResponse({
          user: { id: 'user-1', email: 'alex@example.com', is_verified: false },
          workspace: { id: 'workspace-1', name: 'Personal workspace' },
          verification_token: 'verify-token'
        });
      }
      if (url.includes('/auth/verify-email')) return jsonResponse(null, 204);
      if (url.includes('/auth/login')) {
        return jsonResponse({
          user: { id: 'user-1', email: 'alex@example.com', is_verified: true },
          workspace: { id: 'workspace-1', name: 'Personal workspace' },
          csrf_token: 'csrf-token'
        });
      }
      if (url.includes('/projects?workspace_id=')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/token issued/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /verify email/i }));
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(sessionStorage.getItem('rta.auth')).toContain('csrf-token');
  });

  it('creates a project and renders the new-review route link', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects?workspace_id=')) return jsonResponse([]);
      if (url.endsWith('/projects') && init?.method === 'POST') {
        return jsonResponse({
          id: 'project-1',
          workspace_id: authState.workspaceId,
          title: 'Stage 1 launch review',
          description: ''
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: /create project/i }));
    expect(await screen.findByText('Stage 1 launch review')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new review/i })).toHaveAttribute('href', '/projects/project-1/reviews/new');
  });

  it('creates a provider connection from adapter schema fields', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([
          {
            key: 'fake',
            label: 'Deterministic fake provider',
            fields: [{ name: 'scenario', label: 'Scenario', secret: false, required: false, input_type: 'text' }],
            default_capabilities: ['text', 'structured_output']
          }
        ]);
      }
      if (url.includes('/providers/connections') && init?.method === 'POST') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': authState.csrfToken });
        return jsonResponse({ id: 'conn-1', workspace_id: authState.workspaceId, adapter: 'fake' });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/providers');
    expect((await screen.findAllByText('Deterministic fake provider')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /test and save/i }));
    expect(await screen.findByText(/credentials were not returned/i)).toBeInTheDocument();
  });

  it('creates a review, ingests text, preflights and starts a run', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects/project-1/reviews') && init?.method === 'POST') {
        return jsonResponse({
          id: 'review-1',
          workspace_id: authState.workspaceId,
          project_id: 'project-1',
          title: 'Checkout provider migration',
          proposal_text: 'proposal',
          mode: 'standard',
          focus_chips: ['security']
        });
      }
      if (url.includes('/sources/text')) {
        return jsonResponse({ id: 'source-1', filename: 'proposal.md', content_type: 'text/markdown', state: 'ingested', metadata: {}, warnings: [] });
      }
      if (url.includes('/context-packs')) return jsonResponse({ id: 'pack-1' });
      if (url.includes('/preflight')) return jsonResponse({ selected_agents: [{ key: 'cybersecurity_privacy' }], external_research: false });
      if (url.includes('/runs')) return jsonResponse({ id: 'run-1', workspace_id: authState.workspaceId, review_id: 'review-1', state: 'completed', routing_plan: {}, usage: {} });
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /create review/i }));
    await user.click(await screen.findByRole('button', { name: /add pasted text/i }));
    expect(await screen.findByText('proposal.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add context pack/i }));
    await user.click(screen.getByRole('button', { name: /preflight/i }));
    expect(await screen.findByText(/cybersecurity_privacy/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run review/i }));
    await waitFor(() => expect(screen.getByText(/Report preview/i)).toBeInTheDocument());
  });

  it('loads report data, filters findings and exports markdown', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/events')) return jsonResponse([{ id: 'event-1', state: 'completed', message: 'done', sequence: 1 }]);
      if (url.includes('/report/export')) return textResponse('# Exported report');
      if (url.includes('/report')) {
        return jsonResponse({
          data: {
            title: 'Checkout migration',
            provisional_recommendation: 'Proceed with controls',
            executive_summary: 'Summary',
            coverage_map: { sources: 1, agents: ['cybersecurity_privacy'] },
            top_risks: ['Risk'],
            dependencies: [],
            blockers: [],
            assumptions: [],
            evidence_gaps: [],
            sources: ['source'],
            methodology: 'Method',
            findings: [
              {
                id: 'finding-1',
                title: 'Medium risk',
                severity: 'medium',
                confidence: 'high',
                agent: 'operations_delivery',
                category: 'delivery',
                evidence_type: 'source',
                evidence_label: 'source:1',
                summary: 'Needs owner',
                recommended_action: 'Assign owner'
              }
            ]
          }
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-1');
    expect(await screen.findByText('Checkout migration')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'medium' }));
    expect(screen.getByText('Medium risk')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /markdown/i })[0]);
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('# Exported report');
  });
});
