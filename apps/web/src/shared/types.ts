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
};

export type Source = {
  id: string;
  filename: string;
  content_type: string;
  state: 'pending' | 'ingested' | 'failed';
  metadata: Record<string, unknown>;
  warnings: string[];
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
  summary: string;
  recommended_action: string;
};

export type ReportData = {
  title: string;
  provisional_recommendation: string;
  executive_summary: string;
  coverage_map: { sources: number; agents: string[] };
  top_risks: string[];
  dependencies: string[];
  blockers: string[];
  assumptions: string[];
  evidence_gaps: string[];
  findings: ReportFinding[];
  sources: string[];
  methodology: string;
};
