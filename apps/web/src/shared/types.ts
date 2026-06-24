export type Theme = 'dark' | 'light';

export type AuthState = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  csrfToken: string;
};

export type Project = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
};

export type Review = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  proposal_text: string;
  mode: 'basic' | 'standard' | 'in_depth';
  focus_chips: string[];
  external_research: boolean;
  private_research: boolean;
  domain_allowlist: string[];
  domain_blocklist: string[];
};

export type Source = {
  id: string;
  filename: string;
  content_type: string;
  state: 'pending' | 'ingested' | 'failed';
  metadata: Record<string, unknown>;
  warnings: string[];
};

export type ContextPack = {
  id: string;
  workspace_id: string;
  name: string;
  agent_key: string;
  markdown: string;
  version: number;
};

export type ProviderConnection = {
  id: string;
  workspace_id: string;
  adapter: string;
  name: string;
  config: Record<string, unknown>;
  has_credentials: boolean;
};

export type ModelRecord = {
  id: string;
  workspace_id: string;
  provider_connection_id: string;
  model_identifier: string;
  capabilities: string[];
  provenance: string;
  verified: boolean;
  probe_result: Record<string, unknown>;
};

export type ModelProfile = {
  id: string;
  workspace_id: string;
  name: string;
  agent_key: string;
  model_record_id: string;
  explicit_pin: boolean;
};

export type Run = {
  id: string;
  workspace_id: string;
  review_id: string;
  state: string;
  routing_plan: Record<string, unknown>;
  usage: Record<string, unknown>;
};

export type WorkflowSummary = {
  id: string;
  workspace_id: string;
  review_id: string;
  review_title: string;
  project_id: string;
  project_title: string;
  mode: string;
  state: string;
  created_at: string;
  selected_agents: string[];
  top_risks: string[];
  finding_count: number;
  has_report: boolean;
};

export type ReportFinding = {
  id: string;
  title: string;
  severity: string;
  confidence: string;
  agent: string;
  category: string;
  evidence_type: string;
  evidence_label: string;
  evidence_excerpt: string;
  summary: string;
  recommended_action: string;
};

export type RetrievedEvidence = {
  source_id: string;
  source_filename: string;
  locator: string;
  excerpt: string;
  score: number;
};

export type ExternalSource = {
  title: string;
  url: string;
  query: string;
  quality_rank: number;
  captured_at: string;
};

export type ContextPackProvenance = {
  id: string;
  name: string;
  agent_key: string;
  version: number;
  markdown_sha256: string;
};

export type RiskMatrixItem = {
  risk: string;
  likelihood: string;
  impact: string;
  colour_independent_label: string;
};

export type ActionItem = {
  id: string;
  title: string;
  status: string;
  owner: string;
  due: string | null;
  source: string;
};

export type ReportComparison = {
  left_run_id: string;
  right_run_id: string;
  changed_risks: string[];
  changed_assumptions: string[];
  changed_evidence_gaps: string[];
  changed_recommendations: string[];
};

export type EvaluationResult = {
  workspace_id: string;
  fixture_count: number;
  metrics: Record<string, number>;
  adversarial_fixtures: string[];
  live_smoke_tests: string;
};

export type ReportData = {
  title: string;
  provisional_recommendation: string;
  executive_summary: string;
  coverage_map: { sources: number; agents: string[]; retrieved_evidence?: number; external_sources?: number };
  top_risks: string[];
  dependencies: string[];
  blockers: string[];
  assumptions: string[];
  evidence_gaps: string[];
  context_packs: ContextPackProvenance[];
  findings: ReportFinding[];
  retrieved_evidence: RetrievedEvidence[];
  external_sources: ExternalSource[];
  risk_matrix: RiskMatrixItem[];
  dependency_graph: Array<{ from: string; to: string }>;
  time_horizons: Record<string, string[]>;
  evidence_quality: Record<string, unknown>;
  cross_agent_disagreements: Array<{ topic: string; positions: string[] }>;
  strongest_case_for: string;
  strongest_case_against: string;
  pre_mortem: string[];
  scenarios: Record<string, string>;
  validation_experiments: string[];
  action_items: ActionItem[];
  sources: string[];
  methodology: string;
};

export type Governance = {
  workspace_id: string;
  provider_allowlist: string[];
  model_allowlist: string[];
  data_classification_allowlist: string[];
  region_allowlist: string[];
  purpose_allowlist: string[];
  approved_domains: string[];
  retention_days: number;
  preserve_historical_reports: boolean;
  legal_hold: boolean;
  mfa_required: boolean;
  sso_provider: string | null;
  custom_branding: Record<string, unknown>;
  updated_at: string;
};

export type EnterpriseMember = {
  workspace_id: string;
  user_id: string;
  email: string;
  role: string;
};

export type EnterpriseAuditEvent = {
  id: string;
  workspace_id: string | null;
  actor_user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EnterpriseNotification = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type EnterpriseOperations = {
  run_volume: number;
  failure_rate: number;
  security_events: number;
  queue_depth: number;
  tracing_redaction: string;
  quotas: Record<string, number>;
  backup_restore: Record<string, number>;
};

export type ModelComparison = {
  workspace_id: string;
  models: Array<{
    model_identifier: string;
    quality: number;
    cost: number;
    latency_ms: number;
    failure_rate: number;
    capability_coverage: number;
  }>;
};

export type ApiToken = {
  id: string;
  workspace_id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  revoked: boolean;
  plain_token?: string | null;
};

export type WebhookEndpoint = {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  signing_secret?: string | null;
};
