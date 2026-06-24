export function projectResponse() {
  return {
    id: 'project-1',
    workspace_id: 'workspace-1',
    title: 'Stage 1 launch review',
    description: 'Assess product, security, legal and delivery risk.'
  };
}

export function authResponse(extra: Record<string, string | null>) {
  return {
    user: { id: 'user-1', email: 'alex@example.com', is_verified: true },
    workspace: { id: 'workspace-1', name: 'Alex Workspace' },
    csrf_token: null,
    verification_token: null,
    reset_token: null,
    ...extra
  };
}

export function updatedProjectResponse() {
  return {
    ...projectResponse(),
    title: 'Launch decision review',
    description: 'Updated decision scope.'
  };
}

export function reviewResponse() {
  return {
    id: 'review-1',
    workspace_id: 'workspace-1',
    project_id: 'project-1',
    title: 'Checkout provider migration',
    proposal_text: 'Launch the new checkout provider.',
    mode: 'standard',
    focus_chips: ['security', 'policy', 'UX'],
    external_research: true,
    private_research: true,
    domain_allowlist: ['example.com'],
    domain_blocklist: ['localhost', '127.0.0.1', '169.254.169.254']
  };
}

export function sourceResponse(
  filename = 'proposal.txt',
  contentType = 'text/plain',
  metadata: Record<string, unknown> = {}
) {
  return {
    id: 'source-1',
    filename,
    content_type: contentType,
    state: 'ingested',
    metadata: { locator: 'source-1:line-1', ...metadata },
    warnings: []
  };
}

export function contextPackResponse() {
  return {
    id: 'context-1',
    workspace_id: 'workspace-1',
    name: 'Stage 1 governance context',
    agent_key: 'policy_governance',
    markdown: '# Governance\nUse source-linked claims and show assumptions.',
    version: 1
  };
}

export function preflightResponse() {
  return {
    selected_agents: [{ key: 'cybersecurity_privacy' }, { key: 'operations_delivery' }],
    excluded_agents: [{ key: 'legal_regulatory' }],
    external_research: true,
    research_policy: { private_mode: true, domain_allowlist: ['example.com'] },
    provider_route: 'fake.valid',
    warnings: []
  };
}

export function runResponse(state = 'completed') {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    state,
    routing_plan: { provider: 'fake', model: 'fake-valid' },
    usage: { tokens: 0 }
  };
}

export function runEvents() {
  return [
    { id: 'event-1', state: 'intake', message: 'Sources received.', sequence: 1 },
    { id: 'event-2', state: 'quality_gate', message: 'Structured report passed.', sequence: 2 }
  ];
}

export function reportResponse() {
  return {
    title: 'Checkout provider migration',
    provisional_recommendation: 'Proceed with controls.',
    executive_summary: 'Evidence supports a staged rollout with explicit rollback.',
    coverage_map: { sources: 1, agents: ['cybersecurity_privacy'] },
    top_risks: ['Unsupported claim risk'],
    dependencies: ['Support coverage'],
    blockers: [],
    assumptions: ['Traffic can be shifted gradually.'],
    evidence_gaps: ['No load test attached.'],
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
        risk: 'Unsupported claim risk',
        likelihood: 'medium',
        impact: 'medium',
        colour_independent_label: 'M/M'
      }
    ],
    dependency_graph: [{ from: 'Evidence quality', to: 'Operational ownership' }],
    time_horizons: { near: ['Close evidence gaps before rollout.'] },
    evidence_quality: { retrieval_score: 0.91 },
    cross_agent_disagreements: [{ topic: 'Proceed timing', positions: ['Proceed with controls', 'Wait for evidence'] }],
    strongest_case_for: 'A staged rollout can reduce uncertainty.',
    strongest_case_against: 'Unclosed evidence gaps can become operational incidents.',
    pre_mortem: ['Owner gap causes support failure.'],
    scenarios: { best: 'Clean staged launch.', base: 'Narrow launch.', worst: 'Rollback confusion.' },
    validation_experiments: ['Run rollback rehearsal.'],
    action_items: [
      {
        id: 'action-1',
        title: 'Assign validation owner',
        status: 'open',
        owner: 'Unassigned',
        due: null,
        source: 'proposal.txt:1'
      }
    ],
    context_packs: [
      {
        id: 'context-1',
        name: 'Stage 1 governance context',
        agent_key: 'policy_governance',
        version: 1,
        markdown_sha256: 'abcdef1234567890'
      }
    ],
    findings: [
      {
        id: 'finding-1',
        title: 'Unsupported claim risk',
        summary: 'The proposal needs a cited resilience claim before launch.',
        severity: 'medium',
        confidence: 'medium',
        category: 'evidence',
        agent: 'cybersecurity_privacy',
        evidence_label: 'proposal.txt:1',
        evidence_excerpt: 'Adopt the proposal with staged validation, named owners and rollback criteria.'
      }
    ],
    retrieved_evidence: [
      {
        source_id: 'source-1',
        source_filename: 'proposal.txt',
        locator: 'proposal.txt:1',
        excerpt: 'Adopt the proposal with staged validation, named owners and rollback criteria.',
        score: 2.14
      }
    ],
    sources: ['proposal.txt'],
    methodology: 'Deterministic fake-provider review with evidence-linked findings.'
  };
}

export function workflowResponse() {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    review_title: 'Checkout provider migration',
    project_id: 'project-1',
    project_title: 'Launch decision',
    mode: 'standard',
    state: 'completed',
    created_at: '2026-06-24T00:00:00Z',
    selected_agents: ['cybersecurity_privacy', 'operations_delivery'],
    top_risks: ['Unsupported claim risk'],
    finding_count: 1,
    has_report: true
  };
}

export function adapterSchemas() {
  return [
    {
      key: 'fake',
      label: 'Fake local provider',
      fields: [{ name: 'scenario', label: 'Scenario', secret: false, required: true, input_type: 'text' }],
      default_capabilities: ['text', 'structured_output', 'streaming']
    }
  ];
}

export function providerConnectionResponse() {
  return {
    id: 'provider-1',
    workspace_id: 'workspace-1',
    adapter: 'fake',
    name: 'Fake local provider',
    config: { scenario: 'valid' },
    has_credentials: false
  };
}

export function modelRecordResponse() {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'provider-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text', 'structured_output', 'streaming'],
    provenance: 'manual',
    verified: true,
    probe_result: { ok: true, source: 'deterministic_fake_probe' }
  };
}

export function modelProfileResponse() {
  return {
    id: 'profile-1',
    workspace_id: 'workspace-1',
    name: 'Default evidence profile',
    agent_key: 'evidence_context',
    model_record_id: 'model-1',
    explicit_pin: true
  };
}

export function evaluationResponse() {
  return {
    workspace_id: 'workspace-1',
    fixture_count: 10,
    metrics: {
      routing_precision: 0.91,
      routing_recall: 0.9,
      citation_validity: 0.94,
      unsupported_claim_rate: 0.03
    },
    adversarial_fixtures: ['malicious PDF prompt injection', 'malicious website instruction override'],
    live_smoke_tests: 'optional, synthetic-only and disabled by default'
  };
}
