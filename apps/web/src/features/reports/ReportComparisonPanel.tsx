import { GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client';
import type { ReportComparison } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field } from '../../shared/ui';

export function ReportComparisonPanel({ runId }: { runId: string | undefined }) {
  const [otherRunId, setOtherRunId] = useState('');
  const [comparison, setComparison] = useState<ReportComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    /* v8 ignore next */
    if (!runId || !otherRunId.trim()) return;
    setError(null);
    try {
      setComparison(await api.compareReport(runId, otherRunId.trim()));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel stack" aria-labelledby="comparison-heading">
      <div className="section-title">
        <GitCompareArrows size={18} />
        <h2 id="comparison-heading">Report comparison</h2>
      </div>
      <Field label="Other run ID">
        <input value={otherRunId} onChange={(event) => setOtherRunId(event.target.value)} />
      </Field>
      <Button type="button" onClick={() => void compare()} disabled={!runId || !otherRunId.trim()}>
        Compare reports
      </Button>
      <ErrorState message={error} />
      {comparison ? (
        <div className="comparison-grid">
          <ChangeList title="Changed risks" values={comparison.changed_risks} />
          <ChangeList title="Changed assumptions" values={comparison.changed_assumptions} />
          <ChangeList title="Changed evidence gaps" values={comparison.changed_evidence_gaps} />
          <ChangeList title="Changed recommendations" values={comparison.changed_recommendations} />
        </div>
      ) : (
        <EmptyState title="No comparison yet" body="Compare against another completed run to inspect decision drift." />
      )}
    </section>
  );
}

function ChangeList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="metric-tile">
      <strong>{title}</strong>
      {values.length === 0 ? (
        <span>No change recorded.</span>
      ) : (
        <ul className="compact-list">
          {values.map((value) => <li key={value}>{value}</li>)}
        </ul>
      )}
    </div>
  );
}
