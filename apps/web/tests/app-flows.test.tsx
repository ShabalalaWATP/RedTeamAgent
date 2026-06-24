import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextPackResponse, modelResponse, reportResponse, runResponse } from './app-flow-fixtures';
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
          workspace_role: 'owner',
          verification_token: 'verify-token'
        });
      }
      if (url.includes('/auth/verify-email')) return jsonResponse(null, 204);
      if (url.includes('/auth/login')) {
        return jsonResponse({
          user: { id: 'user-1', email: 'alex@example.com', is_verified: true },
          workspace: { id: 'workspace-1', name: 'Personal workspace' },
          workspace_role: 'owner',
          csrf_token: 'csrf-token'
        });
      }
      if (url.includes('/projects?workspace_id=')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth');
    await user.type(screen.getByLabelText(/^email$/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText(/token issued/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /verify email/i }));
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('rta.auth')).toContain('csrf-token');
    expect(sessionStorage.getItem('rta.auth')).toContain('"workspaceRole":"owner"');
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

  it('creates a review, ingests text, preflights and starts a run', async () => {
    storeAuth();
    const user = userEvent.setup();
    let contextPacks: unknown[] = [];
    mockFetch((url, init) => {
      if (url.includes('/projects/project-1/reviews') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          external_research: true,
          private_research: true,
          domain_allowlist: ['example.com'],
          domain_blocklist: ['localhost', '127.0.0.1', '169.254.169.254']
        });
        return jsonResponse({
          id: 'review-1',
          workspace_id: authState.workspaceId,
          project_id: 'project-1',
          title: 'Checkout provider migration',
          proposal_text: 'proposal',
          mode: 'standard',
          focus_chips: ['security'],
          external_research: true,
          private_research: true,
          domain_allowlist: ['example.com'],
          domain_blocklist: ['localhost', '127.0.0.1', '169.254.169.254']
        });
      }
      if (url.includes('/usage/limits')) {
        return jsonResponse({
          daily_review_run_limit: 20,
          runs_started_today: 0,
          runs_remaining_today: 20,
          resets_at: '2026-06-25T00:00:00Z'
        });
      }
      if (url.includes('/sources/text')) {
        return jsonResponse({ id: 'source-1', filename: 'proposal.md', content_type: 'text/markdown', state: 'ingested', metadata: {}, warnings: [] });
      }
      if (url.includes('/sources/website')) {
        return jsonResponse({
          id: 'source-web',
          filename: 'example.com.html',
          content_type: 'text/html',
          state: 'ingested',
          metadata: { source_kind: 'website' },
          warnings: ['DNS revalidation recorded']
        });
      }
      if (url.includes('/sources/repository')) {
        return jsonResponse({
          id: 'source-repo',
          filename: 'repo.repo.txt',
          content_type: 'text/plain',
          state: 'ingested',
          metadata: { source_kind: 'public_git_repository' },
          warnings: []
        });
      }
      if (url.includes('/sources/upload')) {
        return jsonResponse({
          id: 'source-voice',
          filename: 'voice-note.txt',
          content_type: 'text/plain',
          state: 'ingested',
          metadata: { transcript_quality: 'fallback' },
          warnings: []
        });
      }
      if (url.includes('/context-packs?')) return jsonResponse(contextPacks);
      if (url.endsWith('/context-packs') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({ agent_key: 'policy_governance', workspace_id: authState.workspaceId });
        contextPacks = [contextPackResponse(body)];
        return jsonResponse(contextPacks[0]);
      }
      if (url.includes('/preflight')) {
        return jsonResponse({
          selected_agents: [{ key: 'cybersecurity_privacy' }],
          external_research: true,
          research_policy: { private_mode: true, domain_allowlist: ['example.com'] }
        });
      }
      if (url.includes('/reviews/review-1/runs') && init?.method === 'POST') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([{ id: 'event-1', state: 'completed', message: 'done', sequence: 1 }]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByLabelText(/enable external research/i));
    await user.clear(screen.getByLabelText(/domain allow-list/i));
    await user.type(screen.getByLabelText(/domain allow-list/i), 'example.com');
    await user.click(screen.getByRole('button', { name: /create review/i }));
    await user.click(await screen.findByRole('button', { name: /add pasted text/i }));
    expect(await screen.findByText('proposal.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /snapshot website/i }));
    expect(await screen.findByText('example.com.html')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ingest repository/i }));
    expect(await screen.findByText('repo.repo.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    expect(await screen.findByText('voice-note.txt')).toBeInTheDocument();
    expect(screen.getByText(/fallback note submitted/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add context pack/i }));
    expect(await screen.findByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('policy_governance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /preflight/i }));
    expect(await screen.findByText(/cybersecurity_privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/domain_allowlist/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run review/i }));
    await waitFor(() => expect(screen.getByText(/Report preview/i)).toBeInTheDocument());
  });

  it('loads report data, filters findings and exports markdown', async () => {
    storeAuth();
    const user = userEvent.setup();
    const createObjectUrl = vi.fn(() => 'blob:report');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('run-1', 'completed'));
      if (url.includes('/reviews/review-1/runs') && init?.method === 'POST') return jsonResponse(runResponse('run-2', 'completed'));
      if (url.endsWith('/runs/run-2') && init?.method === 'GET') return jsonResponse(runResponse('run-2', 'completed'));
      if (url.includes('/runs/run-2/events')) return jsonResponse([]);
      if (url.includes('/runs/run-2/report')) return jsonResponse({ data: reportResponse() });
      if (url.includes('/events')) return jsonResponse([{ id: 'event-1', state: 'completed', message: 'done', sequence: 1 }]);
      if (url.includes('/report/compare')) {
        return jsonResponse({
          left_run_id: 'run-1',
          right_run_id: 'run-previous',
          changed_risks: ['Legacy risk removed'],
          changed_assumptions: [],
          changed_evidence_gaps: ['New evidence gap'],
          changed_recommendations: []
        });
      }
      if (url.includes('/report/export')) return textResponse('# Exported report');
      if (url.includes('/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-1');
    expect(await screen.findByText('Checkout migration')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /risk matrix/i })).toBeInTheDocument();
    expect(screen.getByText('Owner gap causes failure.')).toBeInTheDocument();
    expect(screen.getByText('External source')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'medium' }));
    expect(screen.getAllByText('Medium risk').length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /markdown/i })[0]);
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('# Exported report');
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('PDF export generated (17 bytes).');
    await user.type(screen.getByLabelText(/other run id/i), 'run-previous');
    await user.click(screen.getByRole('button', { name: /compare reports/i }));
    expect(await screen.findByText('Legacy risk removed')).toBeInTheDocument();
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
