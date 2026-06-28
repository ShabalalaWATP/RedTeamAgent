import { authState } from './test-utils';

export function modelResponse() {
  return {
    id: 'model-1',
    workspace_id: authState.workspaceId,
    provider_connection_id: 'conn-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text', 'structured_output', 'streaming'],
    provenance: 'manual',
    verified: true,
    probe_result: { ok: true, source: 'manual' }
  };
}

export function contextPackResponse(body: Record<string, string>) {
  return {
    id: 'pack-1',
    workspace_id: authState.workspaceId,
    name: body.name,
    agent_key: body.agent_key,
    markdown: body.markdown,
    version: 1
  };
}

export function runResponse(id: string, state: string) {
  return {
    id,
    workspace_id: authState.workspaceId,
    review_id: 'review-1',
    state,
    routing_plan: {},
    usage: {}
  };
}

export function reportResponse() {
  return {
    title: 'Checkout migration',
    provisional_recommendation: 'Proceed with controls',
    executive_summary: 'Summary',
    coverage_map: { sources: 1, agents: ['cybersecurity_privacy'] },
    top_risks: ['Risk'],
    dependencies: [],
    blockers: [],
    assumptions: [],
    evidence_gaps: [],
    external_sources: [
      {
        title: 'External source',
        url: 'https://example.com/research',
        query: 'Decision readiness research',
        quality_rank: 1,
        captured_at: '2026-06-24T00:00:00Z'
      }
    ],
    risk_matrix: [
      {
        risk: 'Medium risk',
        likelihood: 'medium',
        impact: 'medium',
        colour_independent_label: 'M/M'
      }
    ],
    dependency_graph: [{ from: 'Evidence quality', to: 'Operational ownership' }],
    time_horizons: { near: ['Close evidence gaps.'] },
    evidence_quality: { retrieval_score: 0.9 },
    llm_review: {
      schema: 'multi_agent_specialist_output',
      summary: 'The LLM agents returned usable claims.',
      claim_count: 1,
      agent_outputs: [
        {
          agent: 'operations_delivery',
          label: 'Operations and Delivery Agent',
          summary: 'Delivery ownership needs tightening.',
          claims: [{ title: 'Medium risk' }]
        }
      ]
    },
    cross_agent_disagreements: [{ topic: 'Proceed timing', positions: ['Proceed', 'Wait'] }],
    strongest_case_for: 'Validation can reduce uncertainty.',
    strongest_case_against: 'Evidence gaps remain.',
    pre_mortem: ['Owner gap causes failure.'],
    scenarios: { base: 'Narrow launch.' },
    validation_experiments: ['Run rollback rehearsal.'],
    action_items: [
      {
        id: 'action-1',
        title: 'Assign owner',
        status: 'open',
        owner: 'Unassigned',
        due: null,
        source: 'proposal.md:1'
      }
    ],
    sources: ['source'],
    methodology: 'Method',
    findings: [
      {
        id: 'finding-1',
        title: 'Medium risk',
        severity: 'medium',
        confidence: 'high',
        agent: 'operations_delivery',
        category: 'delivery',
        evidence_type: 'source',
        evidence_label: 'source:1',
        summary: 'Needs owner',
        recommended_action: 'Assign owner'
      }
    ]
  };
}
