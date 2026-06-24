import { z } from 'zod';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const authSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), is_verified: z.boolean() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
  csrf_token: z.string().nullable().optional(),
  verification_token: z.string().nullable().optional(),
  reset_token: z.string().nullable().optional()
});

const projectSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  title: z.string(),
  description: z.string()
});

const reviewSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  title: z.string(),
  proposal_text: z.string(),
  mode: z.enum(['basic', 'standard', 'in_depth']),
  focus_chips: z.array(z.string())
});

const sourceSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  state: z.enum(['pending', 'ingested', 'failed']),
  metadata: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string())
});

const contextPackSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  agent_key: z.string(),
  markdown: z.string(),
  version: z.number()
});

const runSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  review_id: z.string(),
  state: z.string(),
  routing_plan: z.record(z.string(), z.unknown()),
  usage: z.record(z.string(), z.unknown())
});

const workflowSummarySchema = z.object({
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

const providerConnectionSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  adapter: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  has_credentials: z.boolean()
});

const modelRecordSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  provider_connection_id: z.string(),
  model_identifier: z.string(),
  capabilities: z.array(z.string()),
  provenance: z.string(),
  verified: z.boolean(),
  probe_result: z.record(z.string(), z.unknown()).default({})
});

const modelProfileSchema = z.object({
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

const reportSchema = z.object({
  data: z.object({
    title: z.string(),
    provisional_recommendation: z.string(),
    executive_summary: z.string(),
    coverage_map: z.object({
      sources: z.number(),
      agents: z.array(z.string()),
      retrieved_evidence: z.number().optional()
    }),
    top_risks: z.array(z.string()),
    dependencies: z.array(z.string()),
    blockers: z.array(z.string()),
    assumptions: z.array(z.string()),
    evidence_gaps: z.array(z.string()),
    context_packs: z.array(contextPackProvenanceSchema).default([]),
    findings: z.array(z.record(z.string(), z.unknown())),
    retrieved_evidence: z.array(retrievedEvidenceSchema).default([]),
    sources: z.array(z.string()),
    methodology: z.string()
  })
});

type RequestOptions = {
  csrf?: string;
  body?: unknown;
  formData?: FormData;
};

export class ApiClient {
  async register(email: string, password: string) {
    return authSchema.parse(await this.request('/auth/register', 'POST', { body: { email, password } }));
  }

  async verifyEmail(token: string) {
    await this.request('/auth/verify-email', 'POST', { body: { token } });
  }

  async login(email: string, password: string) {
    return authSchema.parse(await this.request('/auth/login', 'POST', { body: { email, password } }));
  }

  async resetPassword(email: string) {
    return authSchema.parse(await this.request('/auth/password-reset/request', 'POST', { body: { email } }));
  }

  async logout(csrf: string) {
    await this.request('/auth/logout', 'POST', { csrf });
  }

  async createProject(csrf: string, workspaceId: string, title: string, description: string) {
    const body = { workspace_id: workspaceId, title, description };
    return projectSchema.parse(await this.request('/projects', 'POST', { csrf, body }));
  }

  async updateProject(csrf: string, projectId: string, title: string, description: string) {
    const body = { title, description };
    return projectSchema.parse(await this.request(`/projects/${projectId}`, 'PUT', { csrf, body }));
  }

  async deleteProject(csrf: string, projectId: string) {
    await this.request(`/projects/${projectId}`, 'DELETE', { csrf });
  }

  async listProjects(workspaceId: string) {
    return z.array(projectSchema).parse(await this.request(`/projects?workspace_id=${workspaceId}`, 'GET'));
  }

  async createReview(csrf: string, projectId: string, body: Record<string, unknown>) {
    return reviewSchema.parse(await this.request(`/projects/${projectId}/reviews`, 'POST', { csrf, body }));
  }

  async addTextSource(csrf: string, reviewId: string, text: string) {
    return sourceSchema.parse(await this.request(`/reviews/${reviewId}/sources/text`, 'POST', { csrf, body: { text } }));
  }

  async uploadSource(csrf: string, reviewId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return sourceSchema.parse(await this.request(`/reviews/${reviewId}/sources/upload`, 'POST', { csrf, formData }));
  }

  async createContextPack(csrf: string, body: Record<string, unknown>) {
    return contextPackSchema.parse(await this.request('/context-packs', 'POST', { csrf, body }));
  }

  async listContextPacks(workspaceId: string) {
    const path = `/context-packs?workspace_id=${encodeURIComponent(workspaceId)}`;
    return z.array(contextPackSchema).parse(await this.request(path, 'GET'));
  }

  async preflight(reviewId: string) {
    return this.request(`/reviews/${reviewId}/preflight`, 'GET');
  }

  async adapterSchemas() {
    return this.request('/providers/adapters', 'GET');
  }

  async createProviderConnection(csrf: string, body: Record<string, unknown>) {
    return providerConnectionSchema.parse(await this.request('/providers/connections', 'POST', { csrf, body }));
  }

  async listProviderConnections(workspaceId: string) {
    return z.array(providerConnectionSchema).parse(
      await this.request(`/providers/connections?workspace_id=${workspaceId}`, 'GET')
    );
  }

  async testProviderConnection(csrf: string, connectionId: string) {
    return this.request(`/providers/connections/${connectionId}/test`, 'POST', { csrf });
  }

  async syncModels(csrf: string, connectionId: string) {
    return z.array(modelRecordSchema).parse(
      await this.request(`/providers/connections/${connectionId}/models/sync`, 'POST', { csrf })
    );
  }

  async createModel(csrf: string, body: Record<string, unknown>) {
    return modelRecordSchema.parse(await this.request('/providers/models', 'POST', { csrf, body }));
  }

  async listModels(workspaceId: string) {
    return z.array(modelRecordSchema).parse(await this.request(`/providers/models?workspace_id=${workspaceId}`, 'GET'));
  }

  async probeModel(csrf: string, modelId: string) {
    return modelRecordSchema.parse(await this.request(`/providers/models/${modelId}/probe`, 'POST', { csrf }));
  }

  async createProfile(csrf: string, body: Record<string, unknown>) {
    return modelProfileSchema.parse(await this.request('/providers/profiles', 'POST', { csrf, body }));
  }

  async listProfiles(workspaceId: string) {
    return z.array(modelProfileSchema).parse(
      await this.request(`/providers/profiles?workspace_id=${workspaceId}`, 'GET')
    );
  }

  async startRun(csrf: string, reviewId: string) {
    return runSchema.parse(await this.request(`/reviews/${reviewId}/runs`, 'POST', { csrf }));
  }

  async getRun(runId: string) {
    return runSchema.parse(await this.request(`/runs/${runId}`, 'GET'));
  }

  async cancelRun(csrf: string, runId: string) {
    return runSchema.parse(await this.request(`/runs/${runId}/cancel`, 'POST', { csrf }));
  }

  eventStreamUrl(runId: string) {
    return `${API_BASE}/runs/${runId}/events/stream`;
  }

  async listWorkflows(workspaceId: string) {
    const path = `/workspaces/${workspaceId}/workflows`;
    return z.array(workflowSummarySchema).parse(await this.request(path, 'GET'));
  }

  async runEvents(runId: string) {
    return this.request(`/runs/${runId}/events`, 'GET');
  }

  async report(runId: string) {
    return reportSchema.parse(await this.request(`/runs/${runId}/report`, 'GET')).data;
  }

  async exportReport(runId: string, fmt: 'markdown' | 'json' | 'html') {
    return this.requestText(`/runs/${runId}/report/export?fmt=${fmt}`);
  }

  private async request(path: string, method: string, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE}${path}`, this.init(method, options));
    if (!response.ok) throw new Error(await this.errorMessage(response));
    if (response.status === 204) return null;
    return response.json();
  }

  private async requestText(path: string) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!response.ok) throw new Error(await this.errorMessage(response));
    return response.text();
  }

  private init(method: string, options: RequestOptions): RequestInit {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
    return { method, credentials: 'include', headers, body };
  }

  private async errorMessage(response: Response) {
    try {
      const data = await response.json();
      return data.message ?? `Request failed with ${response.status}`;
    } catch {
      return `Request failed with ${response.status}`;
    }
  }
}

export const api = new ApiClient();
