import { BarChart3, Download, Filter, GitBranch, ListChecks, Radar, UsersRound } from 'lucide-react';
import type { LlmAgentOutput, ReportData, ReportFinding } from '../../shared/types';
import { Button, EmptyState, Status } from '../../shared/ui';
import { AdvancedReportSections } from './AdvancedReportSections';
import { ReportComparisonPanel } from './ReportComparisonPanel';
import './finalReport.css';
type ExportFormat = 'markdown' | 'json' | 'html';

type FinalReportViewProps = {
  report: ReportData;
  findings: ReportFinding[];
  severity: string;
  runId?: string;
  exportText: string;
  onSeverityChange: (severity: string) => void;
  onExport: (fmt: ExportFormat) => void;
  onExportPdf: () => void;
};

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function FinalReportView({
  report,
  findings,
  severity,
  runId,
  exportText,
  onSeverityChange,
  onExport,
  onExportPdf
}: FinalReportViewProps) {
  return (
    <div className="report-final-layout">
      <div className="report-main-stack">
        <section className="panel report-synthesis" aria-labelledby="orchestrator-heading">
          <div className="section-title">
            <Radar size={18} />
            <h2 id="orchestrator-heading">Orchestrator synthesis</h2>
          </div>
          <h3>{report.title}</h3>
          <p className="report-lede">{report.executive_summary}</p>
          <div className="report-reco">
            <span className="report-reco-label">Recommended decision posture</span>
            <strong>{report.provisional_recommendation}</strong>
          </div>
          <NarrativeBlock report={report} />
        </section>
        <ReportAnalytics report={report} />
        <AgentFindings report={report} />
        <section className="panel stack" aria-labelledby="findings-heading">
          <div className="section-title">
            <Filter size={18} />
            <h2 id="findings-heading">Specialist findings</h2>
          </div>
          <div className="filters" aria-label="Report filters">
            {['all', 'low', 'medium', 'high', 'critical'].map((value) => (
              <Button key={value} aria-pressed={severity === value} onClick={() => onSeverityChange(value)}>
                {value}
              </Button>
            ))}
          </div>
          {findings.length === 0 ? (
            <EmptyState title="No findings match this filter" body="Change the severity filter to see more findings." />
          ) : (
            <div className="report-finding-list" aria-label="Findings">
              {findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
            </div>
          )}
        </section>
        <AdvancedReportSections report={report} />
      </div>
      <aside className="report-support-stack">
        <ExportPanel
          exportText={exportText}
          onExport={onExport}
          onExportPdf={onExportPdf}
        />
        <EvidencePanel report={report} />
        <ReportComparisonPanel runId={runId} />
      </aside>
    </div>
  );
}

function NarrativeBlock({ report }: { report: ReportData }) {
  const narrative = report.orchestrator_narrative;
  const fallbackPlan = report.action_items.map((item) => item.title);
  const likelyIntent = narrative?.likely_user_intent
    || `This review is working out whether ${report.title} is viable in practice, not just whether it sounds plausible.`;
  const synthesis = narrative?.synthesis
    || 'The combined view is that the plan needs explicit ownership, evidence thresholds and operating constraints.';
  return (
    <div className="report-narrative-grid">
      <article>
        <strong>Likely user intent</strong>
        <p>{likelyIntent}</p>
      </article>
      <article>
        <strong>Combined judgement</strong>
        <p>{synthesis}</p>
      </article>
      <ListBlock title="What can work" items={narrative?.what_will_work ?? [report.strongest_case_for]} />
      <ListBlock title="What will not work" items={narrative?.what_will_not_work ?? [report.strongest_case_against]} />
      <ListBlock title="Next decision points" items={narrative?.top_decision_points ?? report.top_risks} />
      <ListBlock title="Recommended plan" items={narrative?.recommended_plan ?? fallbackPlan} />
    </div>
  );
}

function ReportAnalytics({ report }: { report: ReportData }) {
  const counts = severityCounts(report.findings);
  const max = Math.max(...Object.values(counts), 1);
  const topRisks = topFindings(report.findings);
  const dependencies = topDependencies(report);
  return (
    <section className="panel stack" aria-labelledby="analytics-heading">
      <div className="section-title">
        <BarChart3 size={18} />
        <h2 id="analytics-heading">Decision analytics</h2>
      </div>
      <div className="report-kpi-grid">
        <Metric label="Findings" value={String(report.findings.length)} tone="findings" />
        <Metric label="Agents run" value={String(report.llm_review?.agent_outputs.length ?? report.coverage_map.agents.length)} tone="agents" />
        <Metric label="Evidence items" value={String(report.coverage_map.retrieved_evidence ?? report.retrieved_evidence.length)} tone="evidence" />
        <Metric label="Actions" value={String(report.action_items.length)} tone="actions" />
      </div>
      <div className="report-analytics-grid">
        <article className="report-mini-panel">
          <strong>Severity shape</strong>
          {Object.entries(counts).map(([name, count]) => (
            <div className="bar-row" key={name}>
              <span>{name}</span>
              <div className="bar-track" aria-hidden="true">
                <div className={`bar-fill ${name}`} style={{ width: `${Math.max(6, (count / max) * 100)}%` }} />
              </div>
              <small>{count}</small>
            </div>
          ))}
        </article>
        <article className="report-mini-panel">
          <strong>Top 5 risks</strong>
          <ol className="ranked-list">
            {topRisks.map((finding) => (
              <li key={finding.id}>
                <span>{finding.title}</span>
                <Status tone={severityTone(finding.severity)}>{finding.severity}</Status>
              </li>
            ))}
          </ol>
        </article>
        <article className="report-mini-panel">
          <strong>Top dependencies</strong>
          <ol className="ranked-list">
            {dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}
          </ol>
        </article>
      </div>
    </section>
  );
}

function AgentFindings({ report }: { report: ReportData }) {
  const outputs = report.llm_review?.agent_outputs ?? [];
  const specialists = report.specialist_findings ?? [];
  return (
    <section className="panel stack" aria-labelledby="agents-heading">
      <div className="section-title">
        <UsersRound size={18} />
        <h2 id="agents-heading">Agents run</h2>
      </div>
      {outputs.length === 0 && specialists.length === 0 ? (
        <EmptyState title="No agent record" body="This report did not include structured specialist-agent output." />
      ) : (
        <div className="agent-grid">
          {outputs.length > 0
            ? outputs.map((output) => <AgentCard key={output.agent} output={output} />)
            : specialists.map((item) => <SpecialistCard key={String(item.agent)} item={item} />)}
        </div>
      )}
    </section>
  );
}

function AgentCard({ output }: { output: LlmAgentOutput }) {
  return (
    <article className="agent-card">
      <header>
        <strong>{output.label}</strong>
        <Status tone={output.claims.length > 0 ? 'ok' : 'bad'}>{output.claims.length} findings</Status>
      </header>
      <p>{output.summary || 'No summary returned.'}</p>
      <ul className="compact-list">
        {output.claims.slice(0, 4).map((claim, index) => (
          <li key={`${output.agent}-${index}`}>
            <strong>{claimText(claim, 'title', `Finding ${index + 1}`)}</strong>
            <span>{claimText(claim, 'recommended_action', claimText(claim, 'summary', 'Review this finding.'))}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SpecialistCard({ item }: { item: Record<string, unknown> }) {
  return (
    <article className="agent-card">
      <header>
        <strong>{stringValue(item.label, 'Unknown agent')}</strong>
        <Status tone="info">{numberValue(item.claim_count)} findings</Status>
      </header>
      <p>{stringValue(item.summary, 'No summary returned.')}</p>
    </article>
  );
}

function FindingCard({ finding }: { finding: ReportFinding }) {
  return (
    <article className={`finding-card sev-${finding.severity}`}>
      <header className="finding-card-head">
        <div>
          <strong>{finding.title}</strong>
          <p>{finding.summary}</p>
        </div>
        <div className="finding-badges">
          <Status tone={severityTone(finding.severity)}>{finding.severity}</Status>
          <Status tone="ok">{finding.confidence}</Status>
        </div>
      </header>
      <div className="finding-detail-grid">
        <span>Agent: {finding.agent.replaceAll('_', ' ')}</span>
        <span>Category: {finding.category}</span>
        <span>Evidence: {finding.evidence_label}</span>
      </div>
      {finding.evidence_excerpt ? <p className="muted">{finding.evidence_excerpt}</p> : null}
      <div className="finding-action">
        <ListChecks size={16} />
        <span>{finding.recommended_action}</span>
      </div>
    </article>
  );
}

function EvidencePanel({ report }: { report: ReportData }) {
  return (
    <section className="panel stack">
      <div className="section-title">
        <GitBranch size={18} />
        <h2>Evidence record</h2>
      </div>
      <ListBlock title="Evidence gaps" items={report.evidence_gaps} empty="No open evidence gaps recorded." />
      <h3>Retrieved evidence</h3>
      {report.retrieved_evidence.length === 0 ? (
        <p className="muted">No source excerpts were retrieved for this run.</p>
      ) : (
        <div className="evidence-list">
          {report.retrieved_evidence.map((item) => (
            <article key={item.locator}>
              <strong>{item.locator}</strong>
              <p>{item.excerpt}</p>
              <small>{item.source_filename} · score {item.score.toFixed(2)}</small>
            </article>
          ))}
        </div>
      )}
      <h3>Context packs</h3>
      {report.context_packs.length === 0 ? (
        <p className="muted">No context packs recorded for this run.</p>
      ) : (
        <div className="evidence-list">
          {report.context_packs.map((pack) => (
            <article key={pack.id}>
              <strong>{pack.name}</strong>
              <p>{pack.agent_key}</p>
              <small>SHA-256: {pack.markdown_sha256.slice(0, 12)}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ExportPanel({ exportText, onExport, onExportPdf }: {
  exportText: string;
  onExport: (fmt: ExportFormat) => void;
  onExportPdf: () => void;
}) {
  return (
    <section className="panel stack">
      <h2>Export report</h2>
      <div className="row">
        <Button onClick={() => onExport('markdown')}><Download size={16} /> Markdown</Button>
        <Button onClick={() => onExport('json')}>JSON</Button>
        <Button onClick={() => onExport('html')}>HTML</Button>
        <Button onClick={onExportPdf}>PDF</Button>
      </div>
      {exportText ? <textarea className="export-output" readOnly rows={8} value={exportText} aria-label="Export output" /> : null}
    </section>
  );
}

function ListBlock({ title, items, empty = 'Not recorded.' }: { title: string; items: string[]; empty?: string }) {
  const visible = items.filter(Boolean).slice(0, 5);
  return (
    <article>
      <strong>{title}</strong>
      {visible.length === 0 ? <p>{empty}</p> : <ul className="compact-list">{visible.map((item) => <li key={item}>{item}</li>)}</ul>}
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'findings' | 'agents' | 'evidence' | 'actions' }) {
  return <div className={`metric-tile kpi-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function topFindings(findings: ReportFinding[]) {
  return [...findings].sort((left, right) => (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0)).slice(0, 5);
}

function topDependencies(report: ReportData) {
  const fromGraph = report.dependency_graph.map((edge) => `${edge.from} -> ${edge.to}`);
  return Array.from(new Set([...report.dependencies, ...fromGraph])).slice(0, 5);
}

function severityCounts(findings: ReportFinding[]) {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    const key = finding.severity in SEVERITY_RANK ? finding.severity : 'medium';
    counts[key] += 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
}

function severityTone(severity: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (severity === 'critical' || severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  if (severity === 'low') return 'info';
  return 'info';
}

function claimText(claim: Record<string, unknown>, key: string, fallback: string) {
  return stringValue(claim[key], fallback);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : 0;
}
