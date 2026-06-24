import { AlertTriangle, GitBranch, ListChecks } from 'lucide-react';
import type { ReportData } from '../../shared/types';
import { EmptyState, Status } from '../../shared/ui';

export function AdvancedReportSections({ report }: { report: ReportData }) {
  return (
    <div className="stack">
      <section className="panel stack" aria-labelledby="risk-matrix-heading">
        <div className="section-title">
          <AlertTriangle size={18} />
          <h2 id="risk-matrix-heading">Risk matrix</h2>
        </div>
        {report.risk_matrix.length === 0 ? (
          <EmptyState title="No matrix entries" body="Risk matrix entries appear after report composition." />
        ) : (
          <div className="matrix-grid">
            {report.risk_matrix.map((item) => (
              <article className="metric-tile" key={item.risk}>
                <strong>{item.risk}</strong>
                <span>Likelihood: {item.likelihood}</span>
                <span>Impact: {item.impact}</span>
                <Status tone="warn">{item.colour_independent_label}</Status>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel stack" aria-labelledby="research-heading">
        <h2 id="research-heading">External sources</h2>
        {report.external_sources.length === 0 ? (
          <p className="muted">No external research records were used for this report.</p>
        ) : (
          <div className="list">
            {report.external_sources.map((source) => (
              <article className="list-item" key={`${source.query}-${source.url}`}>
                <div>
                  <strong>{source.title}</strong>
                  <p className="muted">{source.url}</p>
                  <small>Query: {source.query}</small>
                </div>
                <Status tone="info">Rank {source.quality_rank}</Status>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel stack" aria-labelledby="scenario-heading">
        <h2 id="scenario-heading">Cases and scenarios</h2>
        <p><strong>Strongest case for:</strong> {report.strongest_case_for || 'Not recorded.'}</p>
        <p><strong>Strongest case against:</strong> {report.strongest_case_against || 'Not recorded.'}</p>
        <div className="metric-grid">
          {Object.entries(report.scenarios).map(([name, body]) => (
            <div className="metric-tile" key={name}>
              <strong>{name}</strong>
              <span>{body}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel stack" aria-labelledby="dependency-heading">
        <div className="section-title">
          <GitBranch size={18} />
          <h2 id="dependency-heading">Dependencies and disagreements</h2>
        </div>
        <ul className="compact-list">
          {report.dependency_graph.map((edge) => <li key={`${edge.from}-${edge.to}`}>{edge.from} depends on {edge.to}</li>)}
        </ul>
        {report.cross_agent_disagreements.map((item) => (
          <article className="list-item" key={item.topic}>
            <div>
              <strong>{item.topic}</strong>
              <ul className="compact-list">
                {item.positions.map((position) => <li key={position}>{position}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </section>
      <ActionTrackingSection report={report} />
    </div>
  );
}

function ActionTrackingSection({ report }: { report: ReportData }) {
  return (
    <section className="panel stack" aria-labelledby="actions-heading">
      <div className="section-title">
        <ListChecks size={18} />
        <h2 id="actions-heading">Action tracking</h2>
      </div>
      <h3>Pre-mortem</h3>
      <ul className="compact-list">{report.pre_mortem.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Validation experiments</h3>
      <ul className="compact-list">
        {report.validation_experiments.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <div className="list">
        {report.action_items.map((item) => (
          <article className="list-item" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">Owner: {item.owner} · Source: {item.source}</p>
              <small>Due: {item.due ?? 'not scheduled'}</small>
            </div>
            <Status tone={item.status === 'open' ? 'warn' : 'ok'}>{item.status}</Status>
          </article>
        ))}
      </div>
    </section>
  );
}
