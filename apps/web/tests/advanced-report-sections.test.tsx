import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdvancedReportSections } from '../src/features/reports/AdvancedReportSections';
import { reportResponse } from './report-fixtures';

describe('AdvancedReportSections', () => {
  it('shows empty states for optional advanced report sections', () => {
    render(
      <AdvancedReportSections
        report={{
          ...advancedReport(),
          llm_review: { schema: '', summary: '', claim_count: 0, agent_outputs: [] }
        }}
      />
    );

    expect(screen.getByText('No matrix entries')).toBeInTheDocument();
    expect(screen.getByText('No external research records were used for this report.')).toBeInTheDocument();
  });

  it('shows recorded scenarios and action status without relying on colour', () => {
    render(
      <AdvancedReportSections
        report={{
          ...advancedReport(),
          strongest_case_for: 'The plan can work if ownership is clear.',
          strongest_case_against: 'The plan fails if evidence is thin.',
          scenarios: { base: 'Narrow rollout needed.' },
          action_items: [{ id: 'action-1', title: 'Assign owner', status: 'open', owner: 'Ops', due: null, source: 'proposal' }]
        }}
      />
    );

    expect(screen.getByText('The plan can work if ownership is clear.')).toBeInTheDocument();
    expect(screen.getByText('Assign owner')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
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
