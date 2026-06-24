import { authState } from './test-utils';

export function runResponse(state: string) {
  return {
    id: 'run-1',
    workspace_id: authState.workspaceId,
    review_id: 'review-1',
    state,
    routing_plan: {},
    usage: {}
  };
}

export function largeReportResponse() {
  const base = reportResponse();
  return {
    ...base,
    findings: Array.from({ length: 50 }, (_item, index) => ({
      ...base.findings[0],
      id: `finding-${index + 1}`,
      title: `Finding ${index + 1}`,
      severity: index % 2 === 0 ? 'medium' : 'high'
    }))
  };
}

export function reportResponse() {
  return {
    title: 'Streamed report',
    provisional_recommendation: 'Proceed with controls',
    executive_summary: 'Summary',
    coverage_map: { sources: 1, agents: [] },
    top_risks: [],
    dependencies: [],
    blockers: [],
    assumptions: [],
    evidence_gaps: [],
    retrieved_evidence: [
      {
        source_id: 'source-1',
        source_filename: 'proposal.md',
        locator: 'proposal.md:1',
        excerpt: 'Named owner evidence.',
        score: 1.25
      }
    ],
    context_packs: [
      {
        id: 'pack-1',
        name: 'Architecture policy',
        agent_key: 'software_architecture',
        version: 1,
        markdown_sha256: 'abcdef1234567890'
      }
    ],
    sources: [],
    methodology: 'Method',
    findings: [
      {
        id: 'finding-1',
        title: 'Owner needed',
        severity: 'low',
        confidence: 'medium',
        agent: 'operations_delivery',
        category: 'delivery',
        evidence_type: 'source',
        evidence_label: 'proposal.md:1',
        evidence_excerpt: 'Named owner evidence.',
        summary: 'Assign an owner.',
        recommended_action: 'Assign owner'
      }
    ]
  };
}
