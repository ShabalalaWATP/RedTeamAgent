import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdvancedReportSections } from '../src/features/reports/AdvancedReportSections';
import { reportResponse } from './report-fixtures';

describe('AdvancedReportSections', () => {
  it('shows when a report has no recorded LLM agent output', () => {
    render(
      <AdvancedReportSections
        report={{
          ...advancedReport(),
          llm_review: { schema: '', summary: '', claim_count: 0, agent_outputs: [] }
        }}
      />
    );

    expect(screen.getByText('No agent output')).toBeInTheDocument();
  });

  it('shows weak recorded LLM agent output explicitly', () => {
    render(
      <AdvancedReportSections
        report={{
          ...advancedReport(),
          llm_review: {
            schema: 'multi_agent_specialist_output',
            summary: '',
            claim_count: 0,
            agent_outputs: [{ agent: 'evidence_context', label: 'Evidence Agent', summary: '', claims: [] }]
          }
        }}
      />
    );

    expect(screen.getByText('No summary returned.')).toBeInTheDocument();
    expect(screen.getByText('0 claims')).toBeInTheDocument();
  });
});

function advancedReport() {
  return {
    ...reportResponse(),
    risk_matrix: [],
    external_sources: [],
    dependency_graph: [],
    cross_agent_disagreements: [],
    pre_mortem: [],
    validation_experiments: [],
    action_items: [],
    time_horizons: {},
    evidence_quality: {},
    scenarios: {},
    strongest_case_for: '',
    strongest_case_against: ''
  };
}
