import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/app/AuthContext';
import { ReportPage } from '../src/features/reports/ReportPage';
import { authState, jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(
    public url: string,
    public init: EventSourceInit
  ) {
    FakeEventSource.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  fail() {
    this.onerror?.();
  }

  close() {
    this.closed = true;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  FakeEventSource.instances = [];
});

describe('ReportPage run controls', () => {
  it('merges streamed events and loads the report when the run completes', async () => {
    storeAuth();
    vi.stubGlobal('EventSource', FakeEventSource);
    let reportReady = false;
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('specialist_review'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) {
        return reportReady ? jsonResponse({ data: reportResponse() }) : jsonResponse({ message: 'Report not found' }, 404);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Report loading')).toBeInTheDocument();
    expect(FakeEventSource.instances[0].url).toContain('/runs/run-1/events/stream');
    expect(FakeEventSource.instances[0].init).toMatchObject({ withCredentials: true });
    reportReady = true;
    act(() => {
      FakeEventSource.instances[0].emit({ id: 'event-2', state: 'completed', message: 'done', sequence: 2 });
    });
    expect((await screen.findAllByText('completed')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Streamed report')).toBeInTheDocument();
    expect(screen.getByText('Architecture policy')).toBeInTheDocument();
    expect(screen.getByText('software_architecture')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(FakeEventSource.instances[0].closed).toBe(true);
    act(() => FakeEventSource.instances[0].fail());
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('surfaces completed report load failures', async () => {
    storeAuth();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ message: 'Report missing' }, 404);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Report missing');
  });

  it('surfaces cancel and retry failures', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('specialist_review'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ message: 'Report not found' }, 404);
      if (url.endsWith('/runs/run-1/cancel') && init?.method === 'POST') return jsonResponse({ message: 'cancel denied' }, 409);
      if (url.includes('/reviews/review-1/runs') && init?.method === 'POST') return jsonResponse({ message: 'retry denied' }, 500);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Report loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel run/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cancel denied');
    await user.click(screen.getByRole('button', { name: /retry run/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('retry denied');
  });

  it('updates the run snapshot and timeline after successful cancellation', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('specialist_review'));
      if (url.includes('/runs/run-1/events')) {
        return jsonResponse([{ id: 'event-cancelled', state: 'cancelled', message: 'cancelled by user', sequence: 2 }]);
      }
      if (url.includes('/runs/run-1/report')) return jsonResponse({ message: 'Report not found' }, 404);
      if (url.endsWith('/runs/run-1/cancel') && init?.method === 'POST') return jsonResponse(runResponse('cancelled'));
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Report loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel run/i }));
    expect(await screen.findByText('cancelled by user')).toBeInTheDocument();
    expect(screen.getAllByText('cancelled').length).toBeGreaterThan(0);
  });

  it('ignores cancel and retry actions without an authenticated user', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('specialist_review'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ message: 'Report not found' }, 404);
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/runs/run-1']}>
          <Routes>
            <Route path="/runs/:runId" element={<ReportPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Report loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel run/i }));
    await user.click(screen.getByRole('button', { name: /retry run/i }));
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
  });
});

function runResponse(state: string) {
  return {
    id: 'run-1',
    workspace_id: authState.workspaceId,
    review_id: 'review-1',
    state,
    routing_plan: {},
    usage: {}
  };
}

function reportResponse() {
  return {
    title: 'Streamed report',
    provisional_recommendation: 'Proceed with controls',
    executive_summary: 'Summary',
    coverage_map: { sources: 1, agents: [] },
    top_risks: [],
    dependencies: [],
    blockers: [],
    assumptions: [],
    evidence_gaps: [],
    context_packs: [
      {
        id: 'pack-1',
        name: 'Architecture policy',
        agent_key: 'software_architecture',
        version: 1,
        markdown_sha256: 'abcdef1234567890'
      }
    ],
    sources: [],
    methodology: 'Method',
    findings: []
  };
}
