import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/app/AuthContext';
import { Dashboard } from '../src/features/projects/Dashboard';
import { ProviderSettings } from '../src/features/providers/ProviderSettings';
import { ReportPage } from '../src/features/reports/ReportPage';
import { NewReviewPage } from '../src/features/reviews/NewReviewPage';
import { WorkflowHistory } from '../src/features/workflows/WorkflowHistory';
import { jsonResponse, mockFetch } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('unauthenticated and alternate branch states', () => {
  it('ignores unauthenticated actions without issuing workspace requests', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([
          { key: 'fake', label: 'Fake', fields: [], default_capabilities: ['text'] }
        ]);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderWithAuth(<Dashboard />);
    await user.click(screen.getByRole('button', { name: /create project/i }));
    expect(fetchMock).not.toHaveBeenCalled();

    renderWithAuth(<ProviderSettings />);
    await user.click(await screen.findByRole('button', { name: /test and save/i }));
    await user.click(screen.getByText(/advanced ai controls/i));
    const evaluationButton = screen.getByRole('button', { name: /run stage 2 evaluation/i }) as HTMLButtonElement;
    evaluationButton.disabled = false;
    fireEvent.click(evaluationButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    renderWithAuth(
      <Routes>
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
      </Routes>,
      '/projects/project-1/reviews/new'
    );
    await user.click(screen.getByRole('button', { name: /create review/i }));
    await user.click(screen.getByRole('button', { name: /add context pack/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders no-auth workflow and no-run report states without network calls', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => jsonResponse({ message: 'unexpected' }, 500));
    renderWithAuth(<WorkflowHistory />);
    expect(screen.getByText('No workflows yet')).toBeInTheDocument();
    renderWithAuth(
      <Routes>
        <Route path="/runs" element={<ReportPage />} />
      </Routes>,
      '/runs'
    );
    expect(screen.getByText('Report loading')).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: /markdown/i }) as HTMLButtonElement;
    exportButton.disabled = false;
    fireEvent.click(exportButton);
    const pdfButton = screen.getByRole('button', { name: 'PDF' }) as HTMLButtonElement;
    pdfButton.disabled = false;
    fireEvent.click(pdfButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders provider plural sync, unverified probe and missing probe source states', async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([{ key: 'fake', label: 'Fake', fields: [], default_capabilities: ['text'] }]);
      }
      if (url.includes('/providers/connections?')) return jsonResponse([connection(true)]);
      if (url.includes('/providers/models?')) return jsonResponse([model({ probe_result: {} })]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      if (url.includes('/providers/connections/conn-1/models/sync') && init?.method === 'POST') {
        return jsonResponse([model(), model({ id: 'model-2', model_identifier: 'backup' })]);
      }
      if (url.includes('/providers/models/model-1/probe') && init?.method === 'POST') {
        return jsonResponse(model({ verified: false, probe_result: { ok: false, source: 'probe' } }));
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(<ProviderSettings />);

    expect(await screen.findByText(/credentials stored/i)).toBeInTheDocument();
    await user.click(screen.getByText(/advanced ai controls/i));
    expect(screen.getByText('No probe recorded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /refresh models/i }));
    expect(await screen.findByText('Model list refreshed with 2 models.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /probe/i }));
    expect(await screen.findByText(/capability probe needs review/i)).toBeInTheDocument();
  });

  it('keeps disabled review actions defensive when no review exists', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url) => {
      if (url.includes('/context-packs?')) return jsonResponse([]);
      if (url.includes('/usage/limits')) {
        return jsonResponse({
          daily_review_run_limit: 20,
          runs_started_today: 0,
          runs_remaining_today: 20,
          resets_at: '2026-06-25T00:00:00Z'
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(
      <Routes>
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
      </Routes>,
      '/projects/project-1/reviews/new'
    );
    expect(await screen.findByText('No context packs yet')).toBeInTheDocument();
    for (const name of [/add pasted text/i, /preflight/i]) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      button.disabled = false;
      await user.click(button);
    }
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/upload rich evidence/i), file);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps disabled provider model actions defensive without selections', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([{ key: 'fake', label: 'Fake', fields: [], default_capabilities: ['text'] }]);
      }
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(<ProviderSettings />);
    expect(await screen.findByText('No saved provider')).toBeInTheDocument();
    await user.click(screen.getByText(/advanced ai controls/i));
    for (const name of [/register model/i, /assign profile/i]) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      button.disabled = false;
      await user.click(button);
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('shows pending delete state while project deletion is in flight', async () => {
    const user = userEvent.setup();
    let resolveDelete: (value: Response) => void = () => undefined;
    mockFetch((url, init) => {
      if (url.includes('/projects?workspace_id=')) {
        return jsonResponse([{ id: 'project-1', workspace_id: 'workspace-1', title: 'Project', description: '' }]);
      }
      if (url.endsWith('/projects/project-1') && init?.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(<Dashboard />);
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeDisabled();
    await act(async () => {
      resolveDelete(jsonResponse(null, 204));
    });
    await waitFor(() => expect(screen.queryByText('Project')).not.toBeInTheDocument());
  });

  it('keeps unrelated projects when one project is edited', async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/projects?workspace_id=')) {
        return jsonResponse([
          { id: 'project-1', workspace_id: 'workspace-1', title: 'Project one', description: '' },
          { id: 'project-2', workspace_id: 'workspace-1', title: 'Project two', description: '' }
        ]);
      }
      if (url.endsWith('/projects/project-1') && init?.method === 'PUT') {
        return jsonResponse({ id: 'project-1', workspace_id: 'workspace-1', title: 'Renamed', description: '' });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(<Dashboard />);
    await user.click((await screen.findAllByRole('button', { name: /edit/i }))[0]);
    await user.clear(screen.getByLabelText(/edit project title/i));
    await user.type(screen.getByLabelText(/edit project title/i), 'Renamed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
    expect(screen.getByText('Project two')).toBeInTheDocument();
  });

  it('submits empty provider field fallbacks for a newly selected adapter schema', async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes('/providers/adapters')) {
        return jsonResponse([
          { key: 'fake', label: 'Fake', fields: [], default_capabilities: ['text'] },
          {
            key: 'custom',
            label: 'Custom',
            fields: [
              { name: 'api_key', label: 'API key', secret: true, required: true, input_type: 'password' },
              { name: 'endpoint_url', label: 'Endpoint URL', secret: false, required: true, input_type: 'url' }
            ],
            default_capabilities: ['text']
          }
        ]);
      }
      if (url.includes('/providers/connections?')) return jsonResponse([]);
      if (url.includes('/providers/models?')) return jsonResponse([]);
      if (url.includes('/providers/profiles?')) return jsonResponse([]);
      if (url.includes('/providers/connections/conn-1/models/sync') && init?.method === 'POST') {
        return jsonResponse([]);
      }
      if (url.includes('/providers/connections') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          adapter: 'custom',
          config: { endpoint_url: '' },
          credentials: { api_key: '' }
        });
        return jsonResponse(connection());
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(<ProviderSettings />);
    await user.selectOptions(await screen.findByLabelText(/ai provider/i), 'custom');
    await user.click(screen.getByRole('button', { name: /test and save/i }));
    expect(await screen.findByText(/provider connection saved/i)).toBeInTheDocument();
  });

  it('renders empty Markdown context previews', async () => {
    mockFetch((url) => {
      if (url.includes('/context-packs?')) {
        return jsonResponse([
          {
            id: 'pack-empty',
            workspace_id: 'workspace-1',
            name: 'Empty pack',
            agent_key: 'policy_governance',
            markdown: '',
            version: 1
          }
        ]);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    renderWithAuth(
      <Routes>
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
      </Routes>,
      '/projects/project-1/reviews/new'
    );
    expect(await screen.findByText('Markdown context')).toBeInTheDocument();
  });

  it('ignores late context-pack loads after unmount', async () => {
    let resolvePacks: (value: Response) => void = () => undefined;
    mockFetch((url) => {
      if (url.includes('/context-packs?')) {
        return new Promise<Response>((resolve) => {
          resolvePacks = resolve;
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    const rendered = renderWithAuth(
      <Routes>
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
      </Routes>,
      '/projects/project-1/reviews/new'
    );
    rendered.unmount();
    await act(async () => {
      resolvePacks(jsonResponse([]));
    });
  });

  it('ignores late context-pack load errors after unmount', async () => {
    let rejectPacks: (reason: Error) => void = () => undefined;
    mockFetch((url) => {
      if (url.includes('/context-packs?')) {
        return new Promise<Response>((_resolve, reject) => {
          rejectPacks = reject;
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    sessionStorage.setItem('rta.auth', JSON.stringify(auth()));
    const rendered = renderWithAuth(
      <Routes>
        <Route path="/projects/:projectId/reviews/new" element={<NewReviewPage />} />
      </Routes>,
      '/projects/project-1/reviews/new'
    );
    rendered.unmount();
    await act(async () => {
      rejectPacks(new Error('late context failure'));
    });
  });
});

function renderWithAuth(element: ReactElement, path = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </AuthProvider>
  );
}

function auth() {
  return {
    userId: 'user-1',
    email: 'owner@example.com',
    workspaceId: 'workspace-1',
    workspaceName: 'Workspace',
    workspaceRole: 'owner',
    csrfToken: 'csrf-token'
  };
}

function connection(hasCredentials = false) {
  return {
    id: 'conn-1',
    workspace_id: 'workspace-1',
    adapter: 'fake',
    name: 'Fake',
    config: {},
    has_credentials: hasCredentials
  };
}

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'conn-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text'],
    provenance: 'manual',
    verified: true,
    probe_result: { ok: true, source: 'manual' },
    ...overrides
  };
}
