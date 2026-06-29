export type Theme = 'dark' | 'light';
export type {
  ActionItem,
  ContextPackProvenance,
  ExternalSource,
  LlmAgentOutput,
  LlmReview,
  OrchestratorNarrative,
  ReportComparison,
  ReportData,
  ReportFinding,
  RetrievedEvidence,
  RiskMatrixItem
} from './reportTypes';

export type AuthState = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
  csrfToken: string;
  mfaSetupRequired: boolean;
  passkeyVerificationRequired: boolean;
};

export type AccountType = 'owner' | 'admin' | 'user';
export type AccountStatus = 'active' | 'suspended' | 'banned' | 'deleted';
export type AdminScope = 'none' | 'all' | 'selected';

export type SiteUser = {
  id: string;
  email: string;
  is_verified: boolean;
  account_type: AccountType;
  account_status: AccountStatus;
  status_message: string;
  admin_scope: AdminScope;
  admin_managed_user_ids: string[];
  created_at: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  last_seen_at?: string | null;
  last_seen_ip?: string | null;
  run_count: number;
};

export type SiteVisit = {
  id: string;
  user_id?: string | null;
  ip_address: string;
  method: string;
  path: string;
  user_agent: string;
  created_at: string;
};

export type Project = {
  id: string;
  workspace_id: string;
  created_by_user_id?: string | null;
  title: string;
  description: string;
};

export type Review = {
  id: string;
  workspace_id: string;
  project_id: string | null;
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

export type UsageLimits = {
  account_type: AccountType;
  tier_name: string;
  project_limit: number | null;
  projects_used: number;
  projects_remaining: number | null;
  workflow_total_limit: number | null;
  workflows_used: number;
  workflows_remaining: number | null;
  workflow_weekly_limit: number | null;
  workflows_started_this_week: number;
  weekly_workflows_remaining: number | null;
  daily_review_run_limit: number | null;
  runs_started_today: number;
  runs_remaining_today: number | null;
  resets_at: string;
};

export type WorkflowSummary = {
  id: string;
  workspace_id: string;
  review_id: string;
  review_title: string;
  project_id: string | null;
  project_title: string;
  mode: string;
  state: string;
  created_at: string;
  selected_agents: string[];
  top_risks: string[];
  finding_count: number;
  has_report: boolean;
};

export type EvaluationResult = {
  workspace_id: string;
  fixture_count: number;
  metrics: Record<string, number>;
  adversarial_fixtures: string[];
  live_smoke_tests: string;
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
