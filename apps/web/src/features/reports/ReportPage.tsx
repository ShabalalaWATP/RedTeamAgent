import { Download, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { ReportData } from '../../shared/types';
import { Button, EmptyState, ErrorState, Status } from '../../shared/ui';

type RunEvent = {
  id: string;
  state: string;
  message: string;
  sequence: number;
};

export function ReportPage() {
  const { runId } = useParams();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [severity, setSeverity] = useState('all');
  const [exportText, setExportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    Promise.all([api.runEvents(runId), api.report(runId)])
      .then(([eventData, reportData]) => {
        setEvents(eventData as RunEvent[]);
        setReport(reportData as ReportData);
      })
      .catch((err) => setError(err.message));
  }, [runId]);

  const findings = useMemo(() => {
    const source = report?.findings ?? [];
    return severity === 'all' ? source : source.filter((finding) => finding.severity === severity);
  }, [report, severity]);

  const exportReport = async (fmt: 'markdown' | 'json' | 'html') => {
    if (!runId) return;
    setExportText(await api.exportReport(runId, fmt));
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Report preview</h1>
          <p className="muted">Evidence-linked findings with assumptions and methodology visible.</p>
        </div>
        <Status tone={report ? 'ok' : 'info'}>{report ? 'Quality gate passed' : 'Loading'}</Status>
      </div>
      <ErrorState message={error} />
      <div className="grid">
        <main className="panel stack">
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
              <div className="list">
                {findings.map((finding) => (
                  <article className="list-item" key={finding.id}>
                    <div>
                      <strong>{finding.title}</strong>
                      <p className="muted">{finding.summary}</p>
                      <small>Evidence: {finding.evidence_label}</small>
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
        </main>
        <aside className="panel stack">
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
            <Button onClick={() => void exportReport('markdown')}><Download size={16} /> Markdown</Button>
            <Button onClick={() => void exportReport('json')}>JSON</Button>
            <Button onClick={() => void exportReport('html')}>HTML</Button>
          </div>
          {exportText ? <textarea readOnly rows={8} value={exportText} aria-label="Export output" /> : null}
          <h3>Evidence gaps</h3>
          {(report?.evidence_gaps.length ?? 0) === 0 ? (
            <p className="muted">No open evidence gaps recorded for this run.</p>
          ) : (
            <ul>{report?.evidence_gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
          )}
        </aside>
      </div>
    </section>
  );
}
