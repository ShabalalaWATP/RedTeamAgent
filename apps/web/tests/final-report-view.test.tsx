import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportSchema } from '../src/api/schemas';
import { FinalReportView } from '../src/features/reports/FinalReportView';
import { reportResponse } from './report-fixtures';

describe('FinalReportView', () => {
  it('shows specialist fallback records when full LLM agent output is unavailable', () => {
    const report = reportSchema.parse({
      data: {
        ...reportResponse(),
        llm_review: { schema: '', summary: '', claim_count: 0, agent_outputs: [] },
        specialist_findings: [{ agent: 'fallback-agent', claim_count: 'unknown' }]
      }
    }).data;

    render(
      <FinalReportView
        report={report}
        findings={[]}
        severity="all"
        exportText=""
        onSeverityChange={vi.fn()}
        onExport={vi.fn()}
        onExportPdf={vi.fn()}
      />
    );

    expect(screen.getByText('Unknown agent')).toBeInTheDocument();
    expect(screen.getByText('0 findings')).toBeInTheDocument();
    expect(screen.getByText('No summary returned.')).toBeInTheDocument();
  });
});
