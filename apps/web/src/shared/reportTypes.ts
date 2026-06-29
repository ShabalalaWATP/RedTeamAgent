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
  referenced_by_agents?: string[];
  knowledge_ref?: string;
  version: number;
  markdown_sha256: string;
  source?: string;
  source_urls?: string[];
  licence?: string;
  curated_at?: string;
  load_strategy?: string;
  materialised_for_orchestrator?: boolean;
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

export type LlmAgentOutput = {
  agent: string;
  label: string;
  summary: string;
  claims: Array<Record<string, unknown>>;
};

export type LlmReview = {
  schema: string;
  summary: string;
  claim_count: number;
  agent_outputs: LlmAgentOutput[];
};

export type OrchestratorNarrative = {
  likely_user_intent: string;
  synthesis: string;
  agents_run: string[];
  what_will_work: string[];
  what_will_not_work: string[];
  top_decision_points: string[];
  recommended_plan: string[];
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
  agent_cards?: Array<Record<string, unknown>>;
  assurance_agents?: Array<Record<string, unknown>>;
  tool_manifest?: Record<string, unknown>;
  context_strategy?: Record<string, unknown>;
  quality_assurance?: Record<string, unknown>;
  llm_review?: LlmReview;
  specialist_findings?: Array<Record<string, unknown>>;
  orchestrator_narrative?: OrchestratorNarrative;
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
