import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { EvaluationResult } from '../../shared/types';
import { Button, EmptyState, ErrorState, Status } from '../../shared/ui';

export function EvaluationPanel() {
  const { auth } = useAuth();
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runEvaluation = async () => {
    const currentAuth = auth as NonNullable<typeof auth>;
    setError(null);
    setRunning(true);
    try {
      setResult(await api.runStage2Evaluation(currentAuth.csrfToken, currentAuth.workspaceId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel stack" aria-labelledby="evaluation-heading">
      <div className="section-title">
        <FlaskConical size={18} />
        <h2 id="evaluation-heading">Stage 2 evaluation</h2>
      </div>
      <p className="muted">
        Deterministic fixtures measure routing, citation quality, unsupported claims and contradiction handling.
      </p>
      <ErrorState message={error} />
      <Button type="button" variant="primary" onClick={() => void runEvaluation()} disabled={running || !auth}>
        {running ? 'Running evaluation' : 'Run Stage 2 evaluation'}
      </Button>
      {result ? (
        <div className="stack">
          <div className="row">
            <Status tone="ok">{result.fixture_count} fixtures</Status>
            <Status tone="info">{result.live_smoke_tests}</Status>
          </div>
          <div className="metric-grid">
            {Object.entries(result.metrics).map(([name, value]) => (
              <div className="metric-tile" key={name}>
                <strong>{readableMetric(name)}</strong>
                <span>{Math.round(value * 100)}%</span>
              </div>
            ))}
          </div>
          <h3>Adversarial fixtures</h3>
          <ul className="compact-list">
            {result.adversarial_fixtures.map((fixture) => <li key={fixture}>{fixture}</li>)}
          </ul>
        </div>
      ) : (
        <EmptyState title="Evaluation not run" body="Run the deterministic suite before calling Stage 2 complete." />
      )}
    </section>
  );
}

function readableMetric(name: string) {
  return name.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}
