import { cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth, textResponse } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('edge UI flows', () => {
  it('shows auth errors, supports reset and updates fields', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/register')) return jsonResponse({ message: 'duplicate' }, 409);
      if (url.includes('/auth/verify-email')) return jsonResponse({ message: 'bad token' }, 401);
      if (url.includes('/auth/login')) return jsonResponse({ message: 'bad login' }, 401);
      if (url.includes('/auth/password-reset/request')) {
        return jsonResponse({
          user: { id: 'zero', email: 'new@example.com', is_verified: false },
          workspace: { id: 'zero', name: 'none' },
          reset_token: 'reset-token'
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth');
    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), 'another safe phrase');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate');
    await user.type(screen.getByLabelText(/verification token/i), 'bad');
    await user.click(screen.getByRole('button', { name: /verify email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('bad token');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('bad login');
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(await screen.findByText(/reset token issued/i)).toBeInTheDocument();
  });

  it('surfaces dashboard project creation errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects?workspace_id=')) return jsonResponse([]);
      if (url.endsWith('/projects') && init?.method === 'POST') return jsonResponse({ message: 'denied' }, 403);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/dashboard');
    await user.clear(await screen.findByLabelText(/project title/i));
    await user.type(screen.getByLabelText(/project title/i), 'Denied project');
    await user.clear(screen.getByLabelText(/description/i));
    await user.type(screen.getByLabelText(/description/i), 'Denied description');
    await user.click(screen.getByRole('button', { name: /create project/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
  });

  it('surfaces project update and delete errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects?workspace_id=')) {
        return jsonResponse([
          {
            id: 'project-1',
            workspace_id: authState.workspaceId,
            title: 'Risk review',
            description: 'Decision scope'
          }
        ]);
      }
      if (url.endsWith('/projects/project-1') && init?.method === 'PUT') return jsonResponse({ message: 'stale project' }, 409);
      if (url.endsWith('/projects/project-1') && init?.method === 'DELETE') return jsonResponse({ message: 'delete denied' }, 403);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('stale project');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('delete denied');
  });

  it('prevents native form submission on route screens', async () => {
    mockFetch(() => jsonResponse([]));
    renderApp('/auth');
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form') as HTMLFormElement);
    expect(screen.getByRole('heading', { name: 'RedTeamAgent' })).toBeInTheDocument();
    cleanup();

    storeAuth();
    renderApp('/dashboard');
    fireEvent.submit((await screen.findByLabelText(/project title/i)).closest('form') as HTMLFormElement);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    cleanup();

    storeAuth();
    renderApp('/providers');
    fireEvent.submit((await screen.findByLabelText(/adapter/i)).closest('form') as HTMLFormElement);
    expect(screen.getByRole('heading', { name: 'Provider settings' })).toBeInTheDocument();
    cleanup();

    storeAuth();
    renderApp('/projects/project-1/reviews/new');
    fireEvent.submit(screen.getByLabelText(/^title$/i).closest('form') as HTMLFormElement);
    expect(screen.getByRole('heading', { name: 'New review' })).toBeInTheDocument();
  });

  it('recovers from malformed stored auth and logs out cleanly', async () => {
    sessionStorage.setItem('rta.auth', 'not-json');
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'RedTeamAgent' })).toBeInTheDocument();
    expect(sessionStorage.getItem('rta.auth')).toBeNull();
    cleanup();

    storeAuth();
    mockFetch((url) => {
      if (url.includes('/projects?workspace_id=')) return jsonResponse([]);
      if (url.includes('/auth/logout')) return jsonResponse(null, 204);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: 'RedTeamAgent' })).toBeInTheDocument();
  });

  it('renders secret provider fields and handles save errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([
          {
            key: 'fake',
            label: 'Fake',
            fields: [],
            default_capabilities: ['text']
          },
          {
            key: 'openai',
            label: 'OpenAI',
            fields: [{ name: 'api_key', label: 'API key', secret: true, required: true, input_type: 'password' }],
            default_capabilities: ['text', 'streaming']
          }
        ]);
      }
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      if (url.includes('/providers/connections') && init?.method === 'POST') return jsonResponse({ message: 'missing key' }, 422);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/providers');
    await user.selectOptions(await screen.findByLabelText(/adapter/i), 'openai');
    expect(screen.getByLabelText(/api key/i)).toHaveAttribute('type', 'password');
    await user.type(screen.getByLabelText(/api key/i), 'secret-value');
    await user.clear(screen.getByLabelText(/connection name/i));
    await user.type(screen.getByLabelText(/connection name/i), 'OpenAI test');
    await user.click(screen.getByRole('button', { name: /test and save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('missing key');
  });

  it('shows empty provider schema state and ignores save without an adapter schema', async () => {
    storeAuth();
    const user = userEvent.setup();
    const fetchMock = mockFetch((url) => {
      if (url.includes('/providers/adapters')) return jsonResponse([]);
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/providers');
    expect(await screen.findByText('No adapters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /test and save/i }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('uses privacy-preserving password reset copy when no local token is returned', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/auth/password-reset/request')) {
        return jsonResponse({
          user: { id: 'zero', email: 'new@example.com', is_verified: false },
          workspace: { id: 'zero', name: 'none' }
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/auth');
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(await screen.findByText(/if the account exists/i)).toBeInTheDocument();
  });

  it('uploads a source from the review composer and shows failed state', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects/project-1/reviews') && init?.method === 'POST') {
        return jsonResponse({
          id: 'review-1',
          workspace_id: authState.workspaceId,
          project_id: 'project-1',
          title: 'Changed title',
          proposal_text: 'changed proposal',
          mode: 'basic',
          focus_chips: ['ops']
        });
      }
      if (url.includes('/sources/upload')) {
        return jsonResponse({ id: 'source-2', filename: 'bad.pdf', content_type: 'application/pdf', state: 'failed', metadata: {}, warnings: ['No text'] });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/projects/project-1/reviews/new');
    await user.clear(screen.getByLabelText(/^title$/i));
    await user.type(screen.getByLabelText(/^title$/i), 'Changed title');
    await user.clear(screen.getByLabelText(/^proposal$/i));
    await user.type(screen.getByLabelText(/^proposal$/i), 'changed proposal');
    await user.selectOptions(screen.getByLabelText(/mode/i), 'basic');
    await user.clear(screen.getByLabelText(/focus chips/i));
    await user.type(screen.getByLabelText(/focus chips/i), 'ops');
    await user.click(screen.getByRole('button', { name: /create review/i }));
    const file = new File(['bad'], 'bad.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/upload txt/i), file);
    expect(await screen.findByText('bad.pdf')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('shows review creation errors', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch(() => jsonResponse({ message: 'project missing' }, 404));
    renderApp('/projects/project-1/reviews/new');
    await user.click(screen.getByRole('button', { name: /create review/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('project missing');
  });

  it('shows report load errors, evidence gaps and alternate exports', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.endsWith('/runs/run-2')) {
        return jsonResponse({ id: 'run-2', workspace_id: authState.workspaceId, review_id: 'review-2', state: 'completed', routing_plan: {}, usage: {} });
      }
      if (url.includes('/events')) return jsonResponse([{ id: 'event-1', state: 'failed', message: 'failed', sequence: 1 }]);
      if (url.includes('/report/export?fmt=json')) return textResponse('{"ok":true}');
      if (url.includes('/report/export?fmt=html')) return textResponse('<html></html>');
      if (url.includes('/report')) {
        return jsonResponse({
          data: {
            title: 'Report with gaps',
            provisional_recommendation: 'Pause',
            executive_summary: 'Summary',
            coverage_map: { sources: 0, agents: [] },
            top_risks: [],
            dependencies: [],
            blockers: ['No sources'],
            assumptions: ['Assumption'],
            evidence_gaps: ['Missing source'],
            sources: [],
            methodology: 'Method',
            findings: [
              {
                id: 'finding-high',
                title: 'High risk',
                severity: 'high',
                confidence: 'medium',
                agent: 'cybersecurity_privacy',
                category: 'security',
                evidence_type: 'unknown',
                evidence_label: 'unknown',
                summary: 'Needs validation',
                recommended_action: 'Validate'
              }
            ]
          }
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-2');
    expect(await screen.findByText('Missing source')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('{"ok":true}');
    await user.click(screen.getByRole('button', { name: 'HTML' }));
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('<html></html>');
  });

  it('shows report loading errors', async () => {
    storeAuth();
    mockFetch((url) => {
      if (url.endsWith('/runs/missing')) return jsonResponse({ message: 'run missing' }, 404);
      if (url.includes('/events')) return jsonResponse({ message: 'run missing' }, 404);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/missing');
    expect(await screen.findByRole('alert')).toHaveTextContent('run missing');
  });

  it('shows empty and error states for previous workflows', async () => {
    storeAuth();
    mockFetch((url) => {
      if (url.includes('/workspaces/workspace-1/workflows')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/workflows');
    expect(await screen.findByText('No workflows yet')).toBeInTheDocument();
    cleanup();

    storeAuth();
    mockFetch(() => jsonResponse({ message: 'history unavailable' }, 500));
    renderApp('/workflows');
    expect(await screen.findByRole('alert')).toHaveTextContent('history unavailable');
  });
});
