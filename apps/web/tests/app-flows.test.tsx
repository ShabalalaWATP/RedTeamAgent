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

  it('creates, updates and deletes a project from the dashboard', async () => {
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
      if (url.endsWith('/projects/project-1') && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': authState.csrfToken });
        return jsonResponse({
          id: 'project-1',
          workspace_id: authState.workspaceId,
          title: 'Updated decision review',
          description: 'Updated decision artefact scope'
        });
      }
      if (url.endsWith('/projects/project-1') && init?.method === 'DELETE') return jsonResponse(null, 204);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: /create project/i }));
    expect(await screen.findByText('Stage 1 launch review')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new review/i })).toHaveAttribute('href', '/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.clear(screen.getByLabelText(/edit project title/i));
    await user.type(screen.getByLabelText(/edit project title/i), 'Updated decision review');
    await user.clear(screen.getByLabelText(/edit description/i));
    await user.type(screen.getByLabelText(/edit description/i), 'Updated decision artefact scope');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Updated decision review')).toBeInTheDocument();
    expect(screen.getByText('Updated decision artefact scope')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(screen.queryByText('Updated decision review')).not.toBeInTheDocument());
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
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
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      if (url.includes('/providers/connections') && init?.method === 'POST') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': authState.csrfToken });
        return jsonResponse({
          id: 'conn-1',
          workspace_id: authState.workspaceId,
          adapter: 'fake',
          name: 'Fake local provider',
          config: {},
          has_credentials: false
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/providers');
    expect((await screen.findAllByText('Deterministic fake provider')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /test and save/i }));
    expect(await screen.findByText(/credentials were not returned/i)).toBeInTheDocument();
  });

  it('registers a model record and assigns it to an agent profile', async () => {
    storeAuth();
    const user = userEvent.setup();
    let modelCreated = false;
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([
          { key: 'fake', label: 'Deterministic fake provider', fields: [], default_capabilities: ['text'] }
        ]);
      }
      if (url.includes('/providers/connections?')) {
        return jsonResponse([
          {
            id: 'conn-1',
            workspace_id: authState.workspaceId,
            adapter: 'fake',
            name: 'Fake local provider',
            config: {},
            has_credentials: false
          }
        ]);
      }
      if (url.includes('/providers/models?')) {
        return jsonResponse(modelCreated ? [modelResponse()] : []);
      }
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      if (url.includes('/providers/models') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ model_identifier: 'fake-reviewer' });
        modelCreated = true;
        return jsonResponse(modelResponse());
      }
      if (url.includes('/providers/profiles') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({ agent_key: 'cybersecurity_privacy' });
        return jsonResponse({
          id: 'profile-1',
          workspace_id: authState.workspaceId,
          name: 'Security profile',
          agent_key: 'cybersecurity_privacy',
          model_record_id: 'model-1',
          explicit_pin: true
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/providers');
    expect((await screen.findAllByText('Fake local provider')).length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText(/model identifier/i));
    await user.type(screen.getByLabelText(/model identifier/i), 'fake-reviewer');
    await user.click(screen.getByLabelText(/capability probe verified/i));
    await user.click(screen.getByRole('button', { name: /register model/i }));
    expect(await screen.findByText('Model record saved with visible capability provenance.')).toBeInTheDocument();
    expect(await screen.findByText(/text, structured_output, streaming/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/profile name/i));
    await user.type(screen.getByLabelText(/profile name/i), 'Security profile');
    await user.selectOptions(screen.getByLabelText(/^agent$/i), 'cybersecurity_privacy');
    await user.click(screen.getByLabelText(/explicitly pin/i));
    await user.click(screen.getByRole('button', { name: /assign profile/i }));
    expect(await screen.findByText(/model profile assigned/i)).toBeInTheDocument();
  });

  it('creates a review, ingests text, preflights and starts a run', async () => {
    storeAuth();
    const user = userEvent.setup();
    let contextPacks: unknown[] = [];
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
      if (url.includes('/context-packs?')) return jsonResponse(contextPacks);
      if (url.endsWith('/context-packs') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({ agent_key: 'policy_governance', workspace_id: authState.workspaceId });
        contextPacks = [contextPackResponse(body)];
        return jsonResponse(contextPacks[0]);
      }
      if (url.includes('/preflight')) return jsonResponse({ selected_agents: [{ key: 'cybersecurity_privacy' }], external_research: false });
      if (url.includes('/reviews/review-1/runs') && init?.method === 'POST') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([{ id: 'event-1', state: 'completed', message: 'done', sequence: 1 }]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /create review/i }));
    await user.click(await screen.findByRole('button', { name: /add pasted text/i }));
    expect(await screen.findByText('proposal.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add context pack/i }));
    expect(await screen.findByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('policy_governance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /preflight/i }));
    expect(await screen.findByText(/cybersecurity_privacy/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run review/i }));
    await waitFor(() => expect(screen.getByText(/Report preview/i)).toBeInTheDocument());
  });

  it('loads report data, filters findings and exports markdown', async () => {
    storeAuth();
    const user = userEvent.setup();
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.includes('/reviews/review-1/runs') && init?.method === 'POST') return jsonResponse(runResponse('run-2', 'completed'));
      if (url.endsWith('/runs/run-2') && init?.method === 'GET') return jsonResponse(runResponse('run-2', 'completed'));
      if (url.includes('/runs/run-2/events')) return jsonResponse([]);
      if (url.includes('/runs/run-2/report')) return jsonResponse({ data: reportResponse() });
      if (url.includes('/events')) return jsonResponse([{ id: 'event-1', state: 'completed', message: 'done', sequence: 1 }]);
      if (url.includes('/report/export')) return textResponse('# Exported report');
      if (url.includes('/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-1');
    expect(await screen.findByText('Checkout migration')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'medium' }));
    expect(screen.getByText('Medium risk')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /markdown/i })[0]);
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('# Exported report');
    await user.click(screen.getByRole('button', { name: /retry run/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/reviews/review-1/runs'), expect.anything()));
  });

  it('cancels a running workflow from the report timeline', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('run-1', 'specialist_review'));
      if (url.includes('/runs/run-1/events')) {
        return jsonResponse([{ id: 'event-1', state: 'specialist_review', message: 'running', sequence: 1 }]);
      }
      if (url.includes('/runs/run-1/report')) return jsonResponse({ message: 'Report not found' }, 404);
      if (url.endsWith('/runs/run-1/cancel') && init?.method === 'POST') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': authState.csrfToken });
        return jsonResponse(runResponse('run-1', 'cancelled'));
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-1');
    expect((await screen.findAllByText('specialist_review')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /cancel run/i }));
    expect(await screen.findByText('cancelled')).toBeInTheDocument();
  });

  it('shows previous workflows for the signed-in workspace', async () => {
    storeAuth();
    mockFetch((url) => {
      if (url.includes('/workspaces/workspace-1/workflows')) {
        return jsonResponse([
          {
            id: 'run-1',
            workspace_id: authState.workspaceId,
            review_id: 'review-1',
            review_title: 'Essay argument review',
            project_id: 'project-1',
            project_title: 'University essay',
            mode: 'standard',
            state: 'completed',
            created_at: '2026-06-24T00:00:00Z',
            selected_agents: ['alternative_perspectives', 'product_user_experience'],
            top_risks: ['Unclear evidence chain'],
            finding_count: 3,
            has_report: true
          }
        ]);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/workflows');
    expect(await screen.findByRole('heading', { name: 'Previous workflows' })).toBeInTheDocument();
    expect(screen.getByText('Essay argument review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open report/i })).toHaveAttribute('href', '/runs/run-1');
  });
});

function modelResponse() {
  return {
    id: 'model-1',
    workspace_id: authState.workspaceId,
    provider_connection_id: 'conn-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text', 'structured_output', 'streaming'],
    provenance: 'manual',
    verified: true,
    probe_result: { ok: true, source: 'manual' }
  };
}

function contextPackResponse(body: Record<string, string>) {
  return {
    id: 'pack-1',
    workspace_id: authState.workspaceId,
    name: body.name,
    agent_key: body.agent_key,
    markdown: body.markdown,
    version: 1
  };
}

function runResponse(id: string, state: string) {
  return {
    id,
    workspace_id: authState.workspaceId,
    review_id: 'review-1',
    state,
    routing_plan: {},
    usage: {}
  };
}

function reportResponse() {
  return {
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
  };
}
