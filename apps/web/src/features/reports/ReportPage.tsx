import { Download, Filter, RotateCcw, StopCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { ReportData, Run } from '../../shared/types';
import { Button, EmptyState, ErrorState, Status } from '../../shared/ui';
import { AdvancedReportSections } from './AdvancedReportSections';
import { ReportComparisonPanel } from './ReportComparisonPanel';

type RunEvent = {
  id: string;
  state: string;
  message: string;
  sequence: number;
};

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

    const loadReport = async (state: string) => {
      try {
        const reportData = await api.report(runId);
        if (active) setReport(reportData as ReportData);
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
        if (TERMINAL_STATES.has(next.state)) stream?.close();
      };
      stream.onerror = () => stream?.close();
    }
    return () => {
      active = false;
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

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Report preview</h1>
          <p className="muted">Evidence-linked findings with assumptions and methodology visible.</p>
        </div>
        <Status tone={report ? 'ok' : 'info'}>{run?.state ?? 'Loading'}</Status>
      </div>
      <ErrorState message={error} />
      <div className="grid">
        <div className="stack">
          <section className="panel stack">
            {report ? (
              <>
                <h2>{report.title}</h2>
                <p>{report.executive_summary}</p>
                <Status tone="info">{report.provisional_recommendation}</Status>
                <div className="filters" aria-label="Report filters">
                  <Filter size={16} />
                  {['all', 'low', 'medium', 'high', 'critical'].map((value) => (
                    <Button key={value} onClick={() => setSeverity(value)}>{value}</Button>
                  ))}
                </div>
                <div className="list" aria-label="Findings">
                  {findings.map((finding) => (
                    <article className="list-item" key={finding.id}>
                      <div>
                        <strong>{finding.title}</strong>
                        <p className="muted">{finding.summary}</p>
                        <small>Evidence: {finding.evidence_label}</small>
                        {finding.evidence_excerpt ? <p className="muted">{finding.evidence_excerpt}</p> : null}
                      </div>
                      <div className="stack">
                        <Status tone={finding.severity === 'medium' ? 'warn' : 'info'}>{finding.severity}</Status>
                        <Status tone="ok">{finding.confidence}</Status>
                      </div>
                    </article>
                  ))}
                </div>
                <h3>Methodology</h3>
                <p className="muted">{report.methodology}</p>
              </>
            ) : (
              <EmptyState title="Report loading" body="Run progress and report data will appear here." />
            )}
          </section>
          {report ? <AdvancedReportSections report={report} /> : null}
        </div>
        <aside className="stack">
          <section className="panel stack">
            <h2>Run timeline</h2>
            <ol className="timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.state}</strong>
                  <p className="muted">{event.message}</p>
                </li>
              ))}
            </ol>
            <div className="row">
              <Button onClick={() => void cancelRun()} disabled={!canCancel}>
                <StopCircle size={16} /> Cancel run
              </Button>
              <Button onClick={() => void retryRun()} disabled={!run}>
                <RotateCcw size={16} /> Retry run
              </Button>
            </div>
            <div className="row">
              <Button onClick={() => void exportReport('markdown')} disabled={!report}><Download size={16} /> Markdown</Button>
              <Button onClick={() => void exportReport('json')} disabled={!report}>JSON</Button>
              <Button onClick={() => void exportReport('html')} disabled={!report}>HTML</Button>
              <Button onClick={() => void exportPdf()} disabled={!report}>PDF</Button>
            </div>
            {exportText ? <textarea readOnly rows={8} value={exportText} aria-label="Export output" /> : null}
          </section>
          {report ? <ReportComparisonPanel runId={runId} /> : null}
          <EvidencePanel report={report} />
        </aside>
      </div>
    </section>
  );
}

function EvidencePanel({ report }: { report: ReportData | null }) {
  return (
    <section className="panel stack">
      <h2>Evidence record</h2>
      <h3>Evidence gaps</h3>
      {(report?.evidence_gaps.length ?? 0) === 0 ? (
        <p className="muted">No open evidence gaps recorded for this run.</p>
      ) : (
        <ul>{report?.evidence_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
      )}
      <h3>Retrieved evidence</h3>
      {(report?.retrieved_evidence?.length ?? 0) === 0 ? (
        <p className="muted">No source excerpts were retrieved for this run.</p>
      ) : (
        <div className="list">
          {report?.retrieved_evidence?.map((item) => (
            <article className="list-item" key={item.locator}>
              <div>
                <strong>{item.locator}</strong>
                <p className="muted">{item.excerpt}</p>
                <small>{item.source_filename}</small>
              </div>
              <Status tone="info">{item.score.toFixed(2)}</Status>
            </article>
          ))}
        </div>
      )}
      <h3>Context packs</h3>
      {(report?.context_packs?.length ?? 0) === 0 ? (
        <p className="muted">No context packs recorded for this run.</p>
      ) : (
        <div className="list">
          {report?.context_packs?.map((pack) => (
            <article className="list-item" key={pack.id}>
              <div>
                <strong>{pack.name}</strong>
                <p className="muted">{pack.agent_key}</p>
                <small>SHA-256: {pack.markdown_sha256.slice(0, 12)}</small>
              </div>
              <Status tone="ok">Version {pack.version}</Status>
            </article>
          ))}
        </div>
      )}
    </section>
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
