import { z } from 'zod';

const contextPackProvenanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  agent_key: z.string(),
  referenced_by_agents: z.array(z.string()).default([]),
  knowledge_ref: z.string().optional(),
  version: z.number(),
  markdown_sha256: z.string(),
  source: z.string().default('workspace'),
  source_urls: z.array(z.string()).default([]),
  licence: z.string().optional(),
  curated_at: z.string().optional(),
  load_strategy: z.string().default('lazy_selected_agent_only'),
  materialised_for_orchestrator: z.boolean().default(false)
});

const retrievedEvidenceSchema = z.object({
  source_id: z.string(),
  source_filename: z.string(),
  locator: z.string(),
  excerpt: z.string(),
  score: z.number()
});

const externalSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  query: z.string().default(''),
  quality_rank: z.number().default(0),
  captured_at: z.string().default('')
}).catchall(z.unknown());

const riskMatrixSchema = z.object({
  risk: z.string(),
  likelihood: z.string(),
  impact: z.string(),
  colour_independent_label: z.string()
});

const actionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  owner: z.string(),
  due: z.string().nullable(),
  source: z.string()
});

const reportFindingSchema = z.object({
  id: z.string().default('finding'),
  title: z.string().default('Untitled finding'),
  severity: z.string().default('medium'),
  confidence: z.string().default('medium'),
  agent: z.string().default('unknown'),
  category: z.string().default('review'),
  evidence_type: z.string().default('unknown'),
  evidence_label: z.string().default('review_setup:proposal'),
  evidence_excerpt: z.string().default(''),
  summary: z.string().default(''),
  recommended_action: z.string().default('Review this finding.')
}).catchall(z.unknown());

const llmAgentOutputSchema = z.object({
  agent: z.string().default('unknown'),
  label: z.string().default('Unknown agent'),
  summary: z.string().default(''),
  claims: z.array(z.record(z.string(), z.unknown())).default([])
}).catchall(z.unknown());

const llmReviewSchema = z.object({
  schema: z.string().default(''),
  summary: z.string().default(''),
  claim_count: z.number().default(0),
  agent_outputs: z.array(llmAgentOutputSchema).default([])
}).catchall(z.unknown());

const orchestratorNarrativeSchema = z.object({
  likely_user_intent: z.string().default(''),
  synthesis: z.string().default(''),
  agents_run: z.array(z.string()).default([]),
  what_will_work: z.array(z.string()).default([]),
  what_will_not_work: z.array(z.string()).default([]),
  top_decision_points: z.array(z.string()).default([]),
  recommended_plan: z.array(z.string()).default([])
}).catchall(z.unknown());

export const reportSchema = z.object({
  data: z.object({
    title: z.string(),
    provisional_recommendation: z.string(),
    executive_summary: z.string(),
    coverage_map: z.object({
      sources: z.number(),
      agents: z.array(z.string()),
      retrieved_evidence: z.number().optional(),
      external_sources: z.number().optional()
    }),
    top_risks: z.array(z.string()),
    dependencies: z.array(z.string()),
    blockers: z.array(z.string()),
    assumptions: z.array(z.string()),
    evidence_gaps: z.array(z.string()),
    context_packs: z.array(contextPackProvenanceSchema).default([]),
    agent_cards: z.array(z.record(z.string(), z.unknown())).default([]),
    assurance_agents: z.array(z.record(z.string(), z.unknown())).default([]),
    tool_manifest: z.record(z.string(), z.unknown()).default({}),
    context_strategy: z.record(z.string(), z.unknown()).default({}),
    quality_assurance: z.record(z.string(), z.unknown()).default({}),
    llm_review: llmReviewSchema.optional(),
    specialist_findings: z.array(z.record(z.string(), z.unknown())).default([]),
    orchestrator_narrative: orchestratorNarrativeSchema.optional(),
    findings: z.array(reportFindingSchema),
    retrieved_evidence: z.array(retrievedEvidenceSchema).default([]),
    external_sources: z.array(externalSourceSchema).default([]),
    risk_matrix: z.array(riskMatrixSchema).default([]),
    dependency_graph: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
    time_horizons: z.record(z.string(), z.array(z.string())).default({}),
    evidence_quality: z.record(z.string(), z.unknown()).default({}),
    cross_agent_disagreements: z.array(z.object({ topic: z.string(), positions: z.array(z.string()) })).default([]),
    strongest_case_for: z.string().default(''),
    strongest_case_against: z.string().default(''),
    pre_mortem: z.array(z.string()).default([]),
    scenarios: z.record(z.string(), z.string()).default({}),
    validation_experiments: z.array(z.string()).default([]),
    action_items: z.array(actionItemSchema).default([]),
    sources: z.array(z.string()),
    methodology: z.string()
  })
});

export const reportComparisonSchema = z.object({
  left_run_id: z.string(),
  right_run_id: z.string(),
  changed_risks: z.array(z.string()),
  changed_assumptions: z.array(z.string()),
  changed_evidence_gaps: z.array(z.string()),
  changed_recommendations: z.array(z.string())
});
