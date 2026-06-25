import { z } from 'zod';

import {
  API_BASE,
  apiTokenSchema,
  authSchema,
  catalogueModelSchema,
  contextPackSchema,
  enterpriseAuditSchema,
  enterpriseMemberSchema,
  enterpriseNotificationSchema,
  enterpriseOperationsSchema,
  evaluationResultSchema,
  governanceSchema,
  modelComparisonSchema,
  modelProfileSchema,
  modelRecordSchema,
  projectSchema,
  providerConnectionSchema,
  reportComparisonSchema,
  reportSchema,
  reviewSchema,
  runSchema,
  sourceSchema,
  usageLimitsSchema,
  webhookSchema,
  workflowSummarySchema
} from './schemas';

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

  async confirmResetPassword(token: string, password: string) {
    await this.request('/auth/password-reset/confirm', 'POST', { body: { token, password } });
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

  async addWebsiteSource(csrf: string, reviewId: string, url: string) {
    const body = { url };
    return sourceSchema.parse(await this.request(`/reviews/${reviewId}/sources/website`, 'POST', { csrf, body }));
  }

  async addRepositorySource(csrf: string, reviewId: string, url: string) {
    const body = { url };
    return sourceSchema.parse(await this.request(`/reviews/${reviewId}/sources/repository`, 'POST', { csrf, body }));
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

  async previewProviderModels(csrf: string, body: Record<string, unknown>) {
    return z.array(catalogueModelSchema).parse(await this.request('/providers/models/preview', 'POST', { csrf, body }));
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

  async usageLimits() {
    return usageLimitsSchema.parse(await this.request('/usage/limits', 'GET'));
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

  async compareReport(runId: string, otherRunId: string) {
    const path = `/runs/${runId}/report/compare?other_run_id=${encodeURIComponent(otherRunId)}`;
    return reportComparisonSchema.parse(await this.request(path, 'GET'));
  }

  async exportReport(runId: string, fmt: 'markdown' | 'json' | 'html') {
    return this.requestText(`/runs/${runId}/report/export?fmt=${fmt}`);
  }

  async exportReportPdf(runId: string) {
    return this.requestBlob(`/runs/${runId}/report/export?fmt=pdf`);
  }

  async runStage2Evaluation(csrf: string, workspaceId: string) {
    const path = `/workspaces/${workspaceId}/evaluations/stage2`;
    return evaluationResultSchema.parse(await this.request(path, 'POST', { csrf }));
  }

  async enterpriseGovernance(workspaceId: string) {
    return governanceSchema.parse(await this.request(`/enterprise/workspaces/${workspaceId}/governance`, 'GET'));
  }

  async updateEnterpriseGovernance(csrf: string, workspaceId: string, body: Record<string, unknown>) {
    const path = `/enterprise/workspaces/${workspaceId}/governance`;
    return governanceSchema.parse(await this.request(path, 'PUT', { csrf, body }));
  }

  async enterpriseMembers(workspaceId: string) {
    const path = `/enterprise/workspaces/${workspaceId}/members`;
    return z.array(enterpriseMemberSchema).parse(await this.request(path, 'GET'));
  }

  async inviteEnterpriseMember(csrf: string, workspaceId: string, email: string, role: string) {
    const path = `/enterprise/workspaces/${workspaceId}/invitations`;
    return this.request(path, 'POST', { csrf, body: { email, role } });
  }

  async enterpriseAudit(workspaceId: string) {
    const path = `/enterprise/workspaces/${workspaceId}/audit`;
    return z.array(enterpriseAuditSchema).parse(await this.request(path, 'GET'));
  }

  async enterpriseNotifications(workspaceId: string) {
    const path = `/enterprise/workspaces/${workspaceId}/notifications`;
    return z.array(enterpriseNotificationSchema).parse(await this.request(path, 'GET'));
  }

  async enterpriseOperations(workspaceId: string) {
    const path = `/enterprise/workspaces/${workspaceId}/operations`;
    return enterpriseOperationsSchema.parse(await this.request(path, 'GET'));
  }

  async modelComparison(workspaceId: string) {
    const path = `/enterprise/workspaces/${workspaceId}/model-comparison`;
    return modelComparisonSchema.parse(await this.request(path, 'GET'));
  }

  async createApiToken(csrf: string, workspaceId: string, body: Record<string, unknown>) {
    const path = `/enterprise/workspaces/${workspaceId}/api-tokens`;
    return apiTokenSchema.parse(await this.request(path, 'POST', { csrf, body }));
  }

  async createWebhook(csrf: string, workspaceId: string, body: Record<string, unknown>) {
    const path = `/enterprise/workspaces/${workspaceId}/webhooks`;
    return webhookSchema.parse(await this.request(path, 'POST', { csrf, body }));
  }

  async createCustomAgent(csrf: string, workspaceId: string, body: Record<string, unknown>) {
    return this.request(`/enterprise/workspaces/${workspaceId}/custom-agents`, 'POST', { csrf, body });
  }

  async enforceRetention(csrf: string, workspaceId: string) {
    return this.request(`/enterprise/workspaces/${workspaceId}/retention/enforce`, 'POST', { csrf });
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

  private async requestBlob(path: string) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!response.ok) throw new Error(await this.errorMessage(response));
    return response.blob();
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
