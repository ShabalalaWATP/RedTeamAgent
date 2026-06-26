import { z } from 'zod';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const authSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), is_verified: z.boolean() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
  workspace_role: z.string().nullable().optional(),
  csrf_token: z.string().nullable().optional(),
  verification_token: z.string().nullable().optional(),
  reset_token: z.string().nullable().optional()
});

export const mfaStatusSchema = z.object({
  enabled: z.boolean()
});

export const mfaSetupSchema = z.object({
  enabled: z.boolean(),
  secret: z.string(),
  provisioning_uri: z.string(),
  recovery_codes: z.array(z.string())
});

export const projectSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  title: z.string(),
  description: z.string()
});

export const reviewSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  title: z.string(),
  proposal_text: z.string(),
  mode: z.enum(['basic', 'standard', 'in_depth']),
  focus_chips: z.array(z.string()),
  external_research: z.boolean().default(false),
  private_research: z.boolean().default(true),
  domain_allowlist: z.array(z.string()).default([]),
  domain_blocklist: z.array(z.string()).default([])
});

export const sourceSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  state: z.enum(['pending', 'ingested', 'failed']),
  metadata: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string())
});

export const contextPackSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  agent_key: z.string(),
  markdown: z.string(),
  version: z.number()
});

export const runSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  review_id: z.string(),
  state: z.string(),
  routing_plan: z.record(z.string(), z.unknown()),
  usage: z.record(z.string(), z.unknown())
});

export const usageLimitsSchema = z.object({
  daily_review_run_limit: z.number(),
  runs_started_today: z.number(),
  runs_remaining_today: z.number(),
  resets_at: z.string()
});

export const workflowSummarySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  review_id: z.string(),
  review_title: z.string(),
  project_id: z.string(),
  project_title: z.string(),
  mode: z.string(),
  state: z.string(),
  created_at: z.string(),
  selected_agents: z.array(z.string()),
  top_risks: z.array(z.string()),
  finding_count: z.number(),
  has_report: z.boolean()
});

export const providerConnectionSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  adapter: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  has_credentials: z.boolean()
});

export const modelRecordSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  provider_connection_id: z.string(),
  model_identifier: z.string(),
  capabilities: z.array(z.string()),
  provenance: z.string(),
  verified: z.boolean(),
  probe_result: z.record(z.string(), z.unknown()).default({})
});

export const catalogueModelSchema = z.object({
  model_identifier: z.string(),
  capabilities: z.array(z.string()).default([]),
  provenance: z.string().optional(),
  verified: z.boolean().optional(),
  probe_result: z.record(z.string(), z.unknown()).default({})
});

export const modelProfileSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  agent_key: z.string(),
  model_record_id: z.string(),
  explicit_pin: z.boolean()
});

const contextPackProvenanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  agent_key: z.string(),
  version: z.number(),
  markdown_sha256: z.string()
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
    findings: z.array(z.record(z.string(), z.unknown())),
    retrieved_evidence: z.array(retrievedEvidenceSchema).default([]),
    external_sources: z.array(externalSourceSchema).default([]),
    risk_matrix: z.array(riskMatrixSchema).default([]),
    dependency_graph: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
    time_horizons: z.record(z.string(), z.array(z.string())).default({}),
    evidence_quality: z.record(z.string(), z.unknown()).default({}),
    cross_agent_disagreements: z.array(z.object({
      topic: z.string(),
      positions: z.array(z.string())
    })).default([]),
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

export const evaluationResultSchema = z.object({
  workspace_id: z.string(),
  fixture_count: z.number(),
  metrics: z.record(z.string(), z.number()),
  adversarial_fixtures: z.array(z.string()),
  live_smoke_tests: z.string()
});

export const governanceSchema = z.object({
  workspace_id: z.string(),
  provider_allowlist: z.array(z.string()),
  model_allowlist: z.array(z.string()),
  data_classification_allowlist: z.array(z.string()),
  region_allowlist: z.array(z.string()),
  purpose_allowlist: z.array(z.string()),
  approved_domains: z.array(z.string()),
  retention_days: z.number(),
  preserve_historical_reports: z.boolean(),
  legal_hold: z.boolean(),
  mfa_required: z.boolean(),
  sso_provider: z.string().nullable(),
  custom_branding: z.record(z.string(), z.unknown()),
  updated_at: z.string()
});

export const enterpriseMemberSchema = z.object({
  workspace_id: z.string(),
  user_id: z.string(),
  email: z.string(),
  role: z.string()
});

export const enterpriseAuditSchema = z.object({
  id: z.string(),
  workspace_id: z.string().nullable(),
  actor_user_id: z.string().nullable(),
  action: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string()
});

export const enterpriseNotificationSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  user_id: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  created_at: z.string()
});

export const enterpriseOperationsSchema = z.object({
  run_volume: z.number(),
  failure_rate: z.number(),
  security_events: z.number(),
  queue_depth: z.number(),
  tracing_redaction: z.string(),
  quotas: z.record(z.string(), z.number()),
  backup_restore: z.record(z.string(), z.number())
});

export const modelComparisonSchema = z.object({
  workspace_id: z.string(),
  models: z.array(z.object({
    model_identifier: z.string(),
    quality: z.number(),
    cost: z.number(),
    latency_ms: z.number(),
    failure_rate: z.number(),
    capability_coverage: z.number()
  }))
});

export const apiTokenSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  token_prefix: z.string(),
  scopes: z.array(z.string()),
  rate_limit_per_minute: z.number(),
  revoked: z.boolean(),
  plain_token: z.string().nullable().optional()
});

export const webhookSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  signing_secret: z.string().nullable().optional()
});
