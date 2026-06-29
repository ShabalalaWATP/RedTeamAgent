import { z } from 'zod';

export { reportComparisonSchema, reportSchema } from './reportSchemas';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const authSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    is_verified: z.boolean(),
    account_type: z.enum(['owner', 'admin', 'user']).default('user'),
    account_status: z.enum(['active', 'suspended', 'banned', 'deleted']).default('active')
  }),
  workspace: z.object({ id: z.string(), name: z.string() }),
  workspace_role: z.string().nullable().optional(),
  csrf_token: z.string().nullable().optional(),
  verification_token: z.string().nullable().optional(),
  reset_token: z.string().nullable().optional(),
  mfa_requirements: z.object({
    required: z.boolean().default(false),
    authenticator_app_enabled: z.boolean().default(false),
    passkey_registered: z.boolean().default(false),
    passkey_verified: z.boolean().default(false),
    setup_required: z.boolean().default(false),
    passkey_verification_required: z.boolean().default(false)
  }).default({
    required: false,
    authenticator_app_enabled: false,
    passkey_registered: false,
    passkey_verified: false,
    setup_required: false,
    passkey_verification_required: false
  }),
  mfa_setup_required: z.boolean().default(false),
  passkey_verification_required: z.boolean().default(false)
});

export const captchaChallengeSchema = z.object({
  required: z.boolean(),
  provider: z.enum(['disabled', 'turnstile', 'challenge']),
  token: z.string(),
  prompt: z.string(),
  expires_in_seconds: z.number()
});

export const mfaStatusSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean().default(false)
});

export const mfaSetupSchema = z.object({
  enabled: z.boolean(),
  secret: z.string(),
  provisioning_uri: z.string(),
  recovery_codes: z.array(z.string())
});

export const siteUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  is_verified: z.boolean(),
  account_type: z.enum(['owner', 'admin', 'user']),
  account_status: z.enum(['active', 'suspended', 'banned', 'deleted']),
  status_message: z.string().default(''),
  admin_scope: z.enum(['none', 'all', 'selected']).default('none'),
  admin_managed_user_ids: z.array(z.string()).default([]),
  created_at: z.string(),
  last_login_at: z.string().nullable().optional(),
  last_login_ip: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
  last_seen_ip: z.string().nullable().optional(),
  run_count: z.number().default(0)
});

export const siteVisitSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().optional(),
  ip_address: z.string(),
  method: z.string(),
  path: z.string(),
  user_agent: z.string(),
  created_at: z.string()
});

export const projectSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  created_by_user_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string()
});

export const reviewSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  project_id: z.string().nullable(),
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
  account_type: z.enum(['owner', 'admin', 'user']).default('user'),
  tier_name: z.string().default('User'),
  project_limit: z.number().nullable().default(null),
  projects_used: z.number().default(0),
  projects_remaining: z.number().nullable().default(null),
  workflow_total_limit: z.number().nullable().default(null),
  workflows_used: z.number().default(0),
  workflows_remaining: z.number().nullable().default(null),
  workflow_weekly_limit: z.number().nullable().default(null),
  workflows_started_this_week: z.number().default(0),
  weekly_workflows_remaining: z.number().nullable().default(null),
  daily_review_run_limit: z.number().nullable().default(null),
  runs_started_today: z.number().default(0),
  runs_remaining_today: z.number().nullable().default(null),
  resets_at: z.string()
});

export const workflowSummarySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  review_id: z.string(),
  review_title: z.string(),
  project_id: z.string().nullable(),
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
