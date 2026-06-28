import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/app/AuthContext';
import { AdvancedReportSections } from '../src/features/reports/AdvancedReportSections';
import { ReportComparisonPanel } from '../src/features/reports/ReportComparisonPanel';
import { ReportPage } from '../src/features/reports/ReportPage';
import type { ReportData } from '../src/shared/types';
import { largeReportResponse, reportResponse, runResponse } from './report-fixtures';
import { jsonResponse, mockFetch, renderApp, storeAuth } from './test-utils';

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
    expect((await screen.findAllByText('Completed')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Streamed report')).toBeInTheDocument();
    expect(screen.getByText('Architecture policy')).toBeInTheDocument();
    expect(screen.getByText('software_architecture')).toBeInTheDocument();
    expect(screen.getAllByText('done').length).toBeGreaterThan(0);
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
  it('shows the latest failure stage when a run fails before report creation', async () => {
    storeAuth();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('failed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([{ id: 'event-failed', state: 'failed', message: 'Provider route missing', sequence: 2 }]);
      return url.includes('/runs/run-1/report')
        ? jsonResponse({ message: 'Report not found' }, 404)
        : jsonResponse({ message: 'unexpected' }, 500);
    });
    renderApp('/runs/run-1');
    await screen.findByText('Review failed');
    expect((await screen.findAllByText('Provider route missing')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
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

  it('surfaces report comparison and export failures', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/report/compare')) return jsonResponse({ message: 'comparison denied' }, 409);
      if (url.includes('/report/export?fmt=markdown')) return jsonResponse({ message: 'markdown denied' }, 500);
      if (url.includes('/report/export?fmt=pdf')) return jsonResponse({ message: 'pdf denied' }, 500);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Streamed report')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Markdown' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('markdown denied');
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pdf denied');
    await user.type(screen.getByLabelText(/other run id/i), 'run-previous');
    await user.click(screen.getByRole('button', { name: /compare reports/i }));
    expect(await screen.findByText('comparison denied')).toBeInTheDocument();
  });

  it('keeps PDF export usable when object URLs are unavailable', async () => {
    storeAuth();
    const user = userEvent.setup();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined });
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/report/export?fmt=pdf')) return new Response('PDF bytes', { status: 200 });
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Streamed report')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByLabelText(/export output/i)).toHaveValue('PDF export generated (9 bytes).');
  });

  it('does not compare reports without a current run id', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ message: 'unexpected' }, 500));
    render(<ReportComparisonPanel runId={undefined} />);

    fireEvent.change(screen.getByLabelText(/other run id/i), { target: { value: 'run-previous' } });
    const button = screen.getByRole('button', { name: /compare reports/i }) as HTMLButtonElement;
    button.disabled = false;
    fireEvent.click(button);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not compare reports without another run id', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ message: 'unexpected' }, 500));
    render(<ReportComparisonPanel runId="run-1" />);

    const button = screen.getByRole('button', { name: /compare reports/i }) as HTMLButtonElement;
    button.disabled = false;
    fireEvent.click(button);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders an empty successful report comparison', async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes('/report/compare')) {
        return jsonResponse({
          left_run_id: 'run-1',
          right_run_id: 'run-previous',
          changed_risks: [],
          changed_assumptions: [],
          changed_evidence_gaps: [],
          changed_recommendations: []
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    render(<ReportComparisonPanel runId="run-1" />);

    await user.type(screen.getByLabelText(/other run id/i), 'run-previous');
    await user.click(screen.getByRole('button', { name: /compare reports/i }));

    expect(await screen.findAllByText(/no change recorded/i)).toHaveLength(4);
  });

  it('renders completed action status without relying on colour', () => {
    const report: ReportData = {
      ...reportResponse(),
      external_sources: [],
      action_items: [
        {
          id: 'action-done',
          title: 'Owner assigned',
          status: 'closed',
          owner: 'Delivery lead',
          due: null,
          source: 'proposal.md:1'
        }
      ],
      pre_mortem: ['Failure path recorded.'],
      validation_experiments: ['Run evidence check.'],
      risk_matrix: [],
      dependency_graph: [],
      time_horizons: {},
      evidence_quality: {},
      cross_agent_disagreements: [],
      strongest_case_for: '',
      strongest_case_against: '',
      scenarios: {}
    };

    render(<AdvancedReportSections report={report} />);

    expect(screen.getByText('closed')).toBeInTheDocument();
    expect(screen.getByText('No matrix entries')).toBeInTheDocument();
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
    expect((await screen.findAllByText('cancelled by user')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
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

  it('handles stream events before the initial run snapshot and ignores late loads after unmount', async () => {
    storeAuth();
    vi.stubGlobal('EventSource', FakeEventSource);
    let resolveRun: (value: Response) => void = () => undefined;
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') {
        return new Promise<Response>((resolve) => {
          resolveRun = resolve;
        });
      }
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: reportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    const rendered = renderApp('/runs/run-1');
    act(() => {
      FakeEventSource.instances[0].emit({ id: 'event-early', state: 'framing', message: 'early', sequence: 1 });
    });
    expect((await screen.findAllByText('early')).length).toBeGreaterThan(0);
    rendered.unmount();
    await act(async () => {
      resolveRun(jsonResponse(runResponse('completed')));
    });
  });

  it('tones findings across critical and unrecognised severities', async () => {
    storeAuth();
    const base = reportResponse().findings[0];
    const report = {
      ...reportResponse(),
      findings: [
        { ...base, id: 'finding-critical', title: 'Critical finding', severity: 'critical' },
        { ...base, id: 'finding-unknown', title: 'Unscored finding', severity: 'experimental' }
      ]
    };
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: report });
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    renderApp('/runs/run-1');

    expect(await screen.findByText('Critical finding')).toBeInTheDocument();
    expect(screen.getByText('Unscored finding')).toBeInTheDocument();
    // The unrecognised severity still renders as a (neutral) status pill.
    expect(screen.getAllByText('experimental').length).toBeGreaterThan(0);
  });

  it('renders and filters a 50 finding report within the Stage 1 budget', async () => {
    storeAuth();
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) return jsonResponse({ data: largeReportResponse() });
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    const started = performance.now();
    renderApp('/runs/run-1');

    expect(await screen.findByText('Finding 50')).toBeInTheDocument();
    expect(performance.now() - started).toBeLessThan(2000);
    await user.click(screen.getByRole('button', { name: 'high' }));
    expect(screen.getByText('Finding 2')).toBeInTheDocument();
    expect(screen.queryByText('Finding 1')).not.toBeInTheDocument();
  });

  it('ignores late report and run errors after unmount', async () => {
    storeAuth();
    let resolveReport: (value: Response) => void = () => undefined;
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      if (url.includes('/runs/run-1/report')) {
        return new Promise<Response>((resolve) => {
          resolveReport = resolve;
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });

    const rendered = renderApp('/runs/run-1');
    await screen.findAllByText('Completed');
    rendered.unmount();
    await act(async () => {
      resolveReport(jsonResponse({ data: reportResponse() }));
    });

    let rejectRun: (reason: Error) => void = () => undefined;
    mockFetch((url, init) => {
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') {
        return new Promise<Response>((_resolve, reject) => {
          rejectRun = reject;
        });
      }
      if (url.includes('/runs/run-1/events')) return jsonResponse([]);
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    const second = renderApp('/runs/run-1');
    second.unmount();
    await act(async () => {
      rejectRun(new Error('late failure'));
    });
  });
});
