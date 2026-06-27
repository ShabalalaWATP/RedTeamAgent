import { History, ListChecks, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api
      .listWorkflows(auth.workspaceId)
      .then(setWorkflows)
      .catch((err) => setError((err as Error).message));
  }, [auth?.workspaceId]);

  const startWorkflow = () => {
    navigate('/reviews/new');
  };

  const deleteWorkflow = async (workflowId: string) => {
    setError(null);
    setDeletingId(workflowId);
    try {
      await api.deleteWorkflow(auth!.csrfToken, workflowId);
      setWorkflows((current) => current.filter((workflow) => workflow.id !== workflowId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Workflows</h1>
          <p className="muted">Start a red-team review or reopen previous work.</p>
        </div>
        <Button type="button" variant="primary" onClick={startWorkflow}>Start workflow</Button>
      </div>
      <ErrorState message={error} />
      <div className="panel stack">
        <div className="section-title">
          <History aria-hidden="true" />
          <h2>Previous workflows</h2>
          <Status tone="info">{workflows.length} saved</Status>
        </div>
        {workflows.length === 0 ? (
          <EmptyState title="No workflows yet" body="Start a workflow when you are ready to test an idea, decision, proposal, essay or code change." />
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
                <div className="row">
                  <Button asLink to={`/runs/${workflow.id}`}>
                    <ListChecks size={16} /> Open workflow
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => deleteWorkflow(workflow.id)}
                    disabled={deletingId === workflow.id}
                  >
                    <Trash2 size={16} /> {deletingId === workflow.id ? 'Deleting' : 'Delete'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
