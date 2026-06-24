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

const runSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  review_id: z.string(),
  state: z.string(),
  routing_plan: z.record(z.string(), z.unknown()),
  usage: z.record(z.string(), z.unknown())
});

const reportSchema = z.object({
  data: z.object({
    title: z.string(),
    provisional_recommendation: z.string(),
    executive_summary: z.string(),
    coverage_map: z.object({ sources: z.number(), agents: z.array(z.string()) }),
    top_risks: z.array(z.string()),
    dependencies: z.array(z.string()),
    blockers: z.array(z.string()),
    assumptions: z.array(z.string()),
    evidence_gaps: z.array(z.string()),
    findings: z.array(z.record(z.string(), z.unknown())),
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
    return this.request('/context-packs', 'POST', { csrf, body });
  }

  async preflight(reviewId: string) {
    return this.request(`/reviews/${reviewId}/preflight`, 'GET');
  }

  async adapterSchemas() {
    return this.request('/providers/adapters', 'GET');
  }

  async createProviderConnection(csrf: string, body: Record<string, unknown>) {
    return this.request('/providers/connections', 'POST', { csrf, body });
  }

  async startRun(csrf: string, reviewId: string) {
    return runSchema.parse(await this.request(`/reviews/${reviewId}/runs`, 'POST', { csrf }));
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
