import { RotateCcw, StopCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ReportData, Run } from '../../shared/types';
import { BackButton, Button, EmptyState, ErrorState, Status } from '../../shared/ui';
import { FinalReportView } from './FinalReportView';
import { RunProgressPanel, stageLabel, type RunEvent } from './RunProgressPanel';

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

function mergeEvent(events: RunEvent[], next: RunEvent) {
  const byId = new Map(events.map((event) => [event.id, event]));
  byId.set(next.id, next);
  return Array.from(byId.values()).sort((left, right) => left.sequence - right.sequence);
}

export function ReportPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [severity, setSeverity] = useState('all');
  const [exportText, setExportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    let stream: EventSource | null = null;
    let poller: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (poller) clearInterval(poller);
      poller = null;
    };

    const loadReport = async (state: string) => {
      try {
        const reportData = await api.report(runId);
        if (active) {
          setReport(reportData as ReportData);
          stopPolling();
        }
      } catch (err) {
        if (active && state === 'completed') setError((err as Error).message);
      }
    };

    const loadRun = async () => {
      setError(null);
      try {
        const [runData, eventData] = await Promise.all([api.getRun(runId), api.runEvents(runId)]);
        if (!active) return;
        setRun(runData);
        setEvents(eventData as RunEvent[]);
        if (TERMINAL_STATES.has(runData.state)) stopPolling();
        await loadReport(runData.state);
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    };

    void loadRun();
    if (typeof EventSource !== 'undefined') {
      stream = new EventSource(api.eventStreamUrl(runId), { withCredentials: true });
      stream.onmessage = (message) => {
        const next = JSON.parse(message.data) as RunEvent;
        setEvents((current) => mergeEvent(current, next));
        setRun((current) => (current ? { ...current, state: next.state } : current));
        if (next.state === 'completed') void loadReport(next.state);
        if (TERMINAL_STATES.has(next.state)) {
          stream?.close();
          stopPolling();
        }
      };
      stream.onerror = () => stream?.close();
    }
    poller = setInterval(() => void loadRun(), 5000);
    return () => {
      active = false;
      stopPolling();
      stream?.close();
    };
  }, [runId]);

  const findings = useMemo(() => {
    const source = report?.findings ?? [];
    return severity === 'all' ? source : source.filter((finding) => finding.severity === severity);
  }, [report, severity]);

  const exportReport = async (fmt: 'markdown' | 'json' | 'html') => {
    /* v8 ignore next */
    if (!runId) return;
    setError(null);
    try {
      setExportText(await api.exportReport(runId, fmt));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const exportPdf = async () => {
    /* v8 ignore next */
    if (!runId) return;
    setError(null);
    try {
      const blob = await api.exportReportPdf(runId);
      triggerPdfDownload(blob, `${runId}-report.pdf`);
      setExportText(`PDF export generated (${blob.size} bytes).`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelRun = async () => {
    if (!auth || !runId) return;
    setError(null);
    try {
      const next = await api.cancelRun(auth.csrfToken, runId);
      setRun(next);
      setEvents(await api.runEvents(runId) as RunEvent[]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const retryRun = async () => {
    if (!auth || !run) return;
    setError(null);
    try {
      const next = await api.startRun(auth.csrfToken, run.review_id);
      navigate(`/runs/${next.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const canCancel = run ? !TERMINAL_STATES.has(run.state) : false;
  const latestEvent = events.at(-1);

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>{report ? 'Final report' : 'Review run'}</h1>
          <p className="muted">
            {report
              ? 'Agent findings, orchestrator synthesis, evidence and export options.'
              : 'Live progress is shown here until the report is ready.'}
          </p>
        </div>
        <div className="screen-actions">
          <BackButton fallback="/workflows" />
          <Status tone={run?.state === 'failed' ? 'bad' : report ? 'ok' : 'info'}>{stageLabel(run?.state)}</Status>
        </div>
      </div>
      <ErrorState message={error} />
      {report ? (
        <FinalReportView
          report={report}
          findings={findings}
          severity={severity}
          runId={runId}
          exportText={exportText}
          onSeverityChange={setSeverity}
          onExport={(fmt) => void exportReport(fmt)}
          onExportPdf={() => void exportPdf()}
        />
      ) : (
        <RunStatusView
          events={events}
          latestEvent={latestEvent}
          run={run}
          canCancel={canCancel}
          onCancel={() => void cancelRun()}
          onRetry={() => void retryRun()}
        />
      )}
    </section>
  );
}

function RunStatusView({
  events,
  latestEvent,
  run,
  canCancel,
  onCancel,
  onRetry
}: {
  events: RunEvent[];
  latestEvent?: RunEvent;
  run: Run | null;
  canCancel: boolean;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const emptyTitle = run?.state === 'failed' ? 'Review failed' : 'Report loading';
  const emptyBody = run?.state === 'failed'
    ? latestEvent?.message ?? 'The run failed before a report could be created.'
    : 'Progress updates will appear here automatically until the report is ready.';
  return (
    <div className="grid">
      <section className="panel stack">
        <h2>Run progress</h2>
        <RunProgressPanel events={events} runState={run?.state} />
        <EmptyState title={emptyTitle} body={emptyBody} />
        <div className="row">
          <Button onClick={onCancel} disabled={!canCancel}>
            <StopCircle size={16} /> Cancel run
          </Button>
          <Button onClick={onRetry} disabled={!run}>
            <RotateCcw size={16} /> Retry run
          </Button>
        </div>
      </section>
      <aside className="panel stack">
        <h2>Run timeline</h2>
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{stageLabel(event.state)}</strong>
              <p className="muted">{event.message}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function triggerPdfDownload(blob: Blob, filename: string) {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
