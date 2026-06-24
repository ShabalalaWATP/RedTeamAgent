import { History, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { WorkflowSummary } from '../../shared/types';
import { Button, EmptyState, ErrorState, Status } from '../../shared/ui';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function WorkflowHistory() {
  const { auth } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api
      .listWorkflows(auth.workspaceId)
      .then(setWorkflows)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Previous workflows</h1>
          <p className="muted">Resume earlier red-team reviews across decisions, proposals, essays and projects.</p>
        </div>
        <Status tone="info">{workflows.length} saved</Status>
      </div>
      <ErrorState message={error} />
      <div className="panel stack">
        <div className="section-title">
          <History aria-hidden="true" />
          <h2>Workflow history</h2>
        </div>
        {workflows.length === 0 ? (
          <EmptyState title="No workflows yet" body="Run a review to build a decision history for this workspace." />
        ) : (
          <div className="workflow-list">
            {workflows.map((workflow) => (
              <article className="workflow-item" key={workflow.id}>
                <div className="stack">
                  <div className="workflow-heading">
                    <div>
                      <strong>{workflow.review_title}</strong>
                      <p className="muted">{workflow.project_title}</p>
                    </div>
                    <Status tone={workflow.state === 'completed' ? 'ok' : 'warn'}>{workflow.state}</Status>
                  </div>
                  <p className="muted">{formatDate(workflow.created_at)} · {workflow.mode.replace('_', '-')}</p>
                  <div className="row">
                    <Status tone="info">{workflow.finding_count} findings</Status>
                    {workflow.selected_agents.slice(0, 3).map((agent) => (
                      <Status tone="info" key={agent}>{agent}</Status>
                    ))}
                  </div>
                  {workflow.top_risks.length > 0 ? (
                    <ul className="compact-list">
                      {workflow.top_risks.slice(0, 2).map((risk) => <li key={risk}>{risk}</li>)}
                    </ul>
                  ) : (
                    <p className="muted">No top risks recorded yet.</p>
                  )}
                </div>
                <Button asLink to={`/runs/${workflow.id}`} disabled={!workflow.has_report}>
                  <ListChecks size={16} /> Open report
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
