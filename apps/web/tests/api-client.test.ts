import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiRequestError } from '../src/api/client';
import { jsonResponse, mockFetch, textResponse } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiClient', () => {
  it('uploads files, parses reports and returns text exports', async () => {
    const client = new ApiClient();
    mockFetch((url, init) => {
      if (url.includes('/sources/upload')) {
        expect(init?.body).toBeInstanceOf(FormData);
        return jsonResponse({ id: 'source-1', filename: 'a.txt', content_type: 'text/plain', state: 'ingested', metadata: {}, warnings: [] });
      }
      if (url.includes('/sources/website')) {
        return jsonResponse({
          id: 'source-web',
          filename: 'example.com.html',
          content_type: 'text/html',
          state: 'ingested',
          metadata: { source_kind: 'website' },
          warnings: []
        });
      }
      if (url.includes('/sources/repository')) {
        return jsonResponse({
          id: 'source-repo',
          filename: 'repo.repo.txt',
          content_type: 'text/plain',
          state: 'ingested',
          metadata: { source_kind: 'public_git_repository' },
          warnings: []
        });
      }
      if (url.includes('/report/export')) return textResponse('# report');
      if (url.includes('/report/compare')) {
        return jsonResponse({
          left_run_id: 'run-1',
          right_run_id: 'run-2',
          changed_risks: ['risk'],
          changed_assumptions: [],
          changed_evidence_gaps: [],
          changed_recommendations: ['action']
        });
      }
      if (url.includes('/evaluations/stage2')) {
        return jsonResponse({
          workspace_id: 'workspace-1',
          fixture_count: 10,
          metrics: { routing_precision: 0.91 },
          adversarial_fixtures: ['malicious PDF prompt injection'],
          live_smoke_tests: 'disabled'
        });
      }
      if (url.includes('/workspaces/workspace-1/workflows')) {
        return jsonResponse([
          {
            id: 'run-1',
            workspace_id: 'workspace-1',
            review_id: 'review-1',
            review_title: 'Decision',
            project_id: 'project-1',
            project_title: 'Project',
            mode: 'basic',
            state: 'completed',
            created_at: '2026-06-24T00:00:00Z',
            selected_agents: [],
            top_risks: [],
            finding_count: 0,
            has_report: true
          }
        ]);
      }
      if (url.includes('/auth/mfa/status')) return jsonResponse({ enabled: true });
      if (url.includes('/auth/captcha/challenge')) {
        return jsonResponse({
          required: true,
          provider: 'challenge',
          token: 'signed-challenge',
          prompt: 'What is 2 + 3?',
          expires_in_seconds: 300
        });
      }
      if (url.includes('/auth/mfa/setup')) {
        return jsonResponse({
          enabled: false,
          secret: 'JBSWY3DPEHPK3PXP',
          provisioning_uri: 'otpauth://totp/test',
          recovery_codes: ['aaaa-bbbb']
        });
      }
      if (url.includes('/auth/mfa/enable')) return jsonResponse(null, 204);
      if (url.includes('/auth/mfa/disable')) return jsonResponse(null, 204);
      if (url.endsWith('/projects/project-1') && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf' });
        return jsonResponse({
          id: 'project-1',
          workspace_id: 'workspace-1',
          title: 'Updated',
          description: 'Changed'
        });
      }
      if (url.endsWith('/projects/project-1') && init?.method === 'DELETE') return jsonResponse(null, 204);
      if (url.endsWith('/runs/run-1/cancel') && init?.method === 'POST') return jsonResponse(runResponse('cancelled'));
      if (url.endsWith('/runs/run-1') && init?.method === 'GET') return jsonResponse(runResponse('completed'));
      if (url.includes('/context-packs?')) return jsonResponse([contextPackResponse()]);
      if (url.endsWith('/context-packs') && init?.method === 'POST') return jsonResponse(contextPackResponse());
      if (url.includes('/providers/connections?')) {
        return jsonResponse([
          {
            id: 'conn-1',
            workspace_id: 'workspace-1',
            adapter: 'fake',
            name: 'Fake',
            config: {},
            has_credentials: false
          }
        ]);
      }
      if (url.includes('/providers/connections/conn-1/test')) return jsonResponse({ ok: true });
      if (url.includes('/providers/connections/conn-1/models/sync')) return jsonResponse([modelResponse()]);
      if (url.includes('/providers/models?')) return jsonResponse([modelResponse()]);
      if (url.includes('/providers/models/model-1/probe')) return jsonResponse(modelResponse());
      if (url.includes('/providers/profiles?')) {
        return jsonResponse([
          {
            id: 'profile-1',
            workspace_id: 'workspace-1',
            name: 'Profile',
            agent_key: 'evidence_context',
            model_record_id: 'model-1',
            explicit_pin: false
          }
        ]);
      }
      if (url.includes('/providers/models') && init?.method === 'POST') return jsonResponse(modelResponse());
      if (url.includes('/providers/profiles') && init?.method === 'POST') {
        return jsonResponse({
          id: 'profile-1',
          workspace_id: 'workspace-1',
          name: 'Profile',
          agent_key: 'evidence_context',
          model_record_id: 'model-1',
          explicit_pin: false
        });
      }
      if (url.includes('/report')) {
        return jsonResponse({
          data: {
            title: 'Title',
            provisional_recommendation: 'Proceed',
            executive_summary: 'Summary',
            coverage_map: { sources: 0, agents: [] },
            top_risks: [],
            dependencies: [],
            blockers: [],
            assumptions: [],
            evidence_gaps: [],
            external_sources: [
              {
                title: 'External source',
                url: 'https://example.com',
                query: 'Decision research',
                quality_rank: 1,
                captured_at: '2026-06-24T00:00:00Z'
              }
            ],
            risk_matrix: [
              {
                risk: 'Risk',
                likelihood: 'medium',
                impact: 'high',
                colour_independent_label: 'M/H'
              }
            ],
            dependency_graph: [{ from: 'Evidence', to: 'Owner' }],
            time_horizons: { near: ['Close gaps'] },
            evidence_quality: { retrieval_score: 1 },
            cross_agent_disagreements: [{ topic: 'Timing', positions: ['Wait', 'Proceed'] }],
            strongest_case_for: 'Proceed with controls.',
            strongest_case_against: 'Evidence gaps remain.',
            pre_mortem: ['Owner gap causes failure.'],
            scenarios: { base: 'Narrow launch.' },
            validation_experiments: ['Run rehearsal.'],
            action_items: [
              {
                id: 'action-1',
                title: 'Assign owner',
                status: 'open',
                owner: 'Unassigned',
                due: null,
                source: 'proposal.md:1'
              }
            ],
            findings: [],
            sources: [],
            methodology: 'Method'
          }
        });
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    });
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await expect(client.uploadSource('csrf', 'review-1', file)).resolves.toMatchObject({ state: 'ingested' });
    await expect(client.addWebsiteSource('csrf', 'review-1', 'https://example.com')).resolves.toMatchObject({ id: 'source-web' });
    await expect(client.addRepositorySource('csrf', 'review-1', 'https://github.com/a/b')).resolves.toMatchObject({ id: 'source-repo' });
    await expect(client.updateProject('csrf', 'project-1', 'Updated', 'Changed')).resolves.toMatchObject({ title: 'Updated' });
    await expect(client.deleteProject('csrf', 'project-1')).resolves.toBeUndefined();
    await expect(client.getRun('run-1')).resolves.toMatchObject({ state: 'completed' });
    await expect(client.cancelRun('csrf', 'run-1')).resolves.toMatchObject({ state: 'cancelled' });
    expect(client.eventStreamUrl('run-1')).toMatch('/runs/run-1/events/stream');
    await expect(client.createContextPack('csrf', {})).resolves.toMatchObject({ agent_key: 'policy_governance' });
    await expect(client.listContextPacks('workspace-1')).resolves.toHaveLength(1);
    await expect(client.listProviderConnections('workspace-1')).resolves.toHaveLength(1);
    await expect(client.testProviderConnection('csrf', 'conn-1')).resolves.toMatchObject({ ok: true });
    await expect(client.syncModels('csrf', 'conn-1')).resolves.toHaveLength(1);
    await expect(client.createModel('csrf', {})).resolves.toMatchObject({ id: 'model-1' });
    await expect(client.listModels('workspace-1')).resolves.toHaveLength(1);
    await expect(client.probeModel('csrf', 'model-1')).resolves.toMatchObject({ verified: true });
    await expect(client.createProfile('csrf', {})).resolves.toMatchObject({ name: 'Profile' });
    await expect(client.listProfiles('workspace-1')).resolves.toHaveLength(1);
    await expect(client.listWorkflows('workspace-1')).resolves.toHaveLength(1);
    await expect(client.report('run-1')).resolves.toMatchObject({ title: 'Title' });
    await expect(client.compareReport('run-1', 'run-2')).resolves.toMatchObject({ changed_risks: ['risk'] });
    await expect(client.exportReport('run-1', 'markdown')).resolves.toBe('# report');
    await expect(client.exportReportPdf('run-1')).resolves.toMatchObject({ size: 8 });
    await expect(client.runStage2Evaluation('csrf', 'workspace-1')).resolves.toMatchObject({ fixture_count: 10 });
    await expect(client.captchaChallenge()).resolves.toMatchObject({ provider: 'challenge' });
    await expect(client.mfaStatus()).resolves.toMatchObject({ enabled: true });
    await expect(client.setupMfa('csrf')).resolves.toMatchObject({ secret: 'JBSWY3DPEHPK3PXP' });
    await expect(client.enableMfa('csrf', '123456')).resolves.toBeUndefined();
    await expect(client.disableMfa('csrf', '123456')).resolves.toBeUndefined();
  });

  it('surfaces server and non-json errors', async () => {
    const client = new ApiClient();
    mockFetch(() => jsonResponse({ message: 'No access' }, 403));
    await expect(client.listProjects('workspace-1')).rejects.toThrow('No access');
    mockFetch(() => jsonResponse({}, 500));
    await expect(client.listProjects('workspace-1')).rejects.toThrow(
      'The request could not be completed. Check the details and try again.'
    );
    mockFetch(() => textResponse('broken', 500));
    await expect(client.listProjects('workspace-1')).rejects.toThrow(
      'The request could not be completed. Check the details and try again.'
    );
    await expect(client.exportReport('run-1', 'html')).rejects.toThrow(
      'The request could not be completed. Check the details and try again.'
    );
  });

  it('preserves API error codes for control flow without showing raw status text', async () => {
    const client = new ApiClient();
    mockFetch(() => jsonResponse({ code: 'mfa_required', message: 'Multi-factor authentication code required.' }, 401));
    await expect(client.login('owner@example.com', 'Correct-Horse-42!')).rejects.toMatchObject({
      code: 'mfa_required',
      message: 'Multi-factor authentication code required.'
    } satisfies Partial<ApiRequestError>);
  });
});

function runResponse(state: string) {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    state,
    routing_plan: {},
    usage: {}
  };
}

function modelResponse() {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'conn-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text'],
    provenance: 'manual',
    verified: true,
    probe_result: { ok: true, source: 'test' }
  };
}

function contextPackResponse() {
  return {
    id: 'pack-1',
    workspace_id: 'workspace-1',
    name: 'Policy pack',
    agent_key: 'policy_governance',
    markdown: '# Policy',
    version: 1
  };
}
