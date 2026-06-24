import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api/client';
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
      if (url.includes('/report/export')) return textResponse('# report');
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
      if (url.includes('/providers/models?')) return jsonResponse([modelResponse()]);
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
    await expect(client.updateProject('csrf', 'project-1', 'Updated', 'Changed')).resolves.toMatchObject({ title: 'Updated' });
    await expect(client.deleteProject('csrf', 'project-1')).resolves.toBeUndefined();
    await expect(client.getRun('run-1')).resolves.toMatchObject({ state: 'completed' });
    await expect(client.cancelRun('csrf', 'run-1')).resolves.toMatchObject({ state: 'cancelled' });
    expect(client.eventStreamUrl('run-1')).toMatch('/runs/run-1/events/stream');
    await expect(client.createContextPack('csrf', {})).resolves.toMatchObject({ agent_key: 'policy_governance' });
    await expect(client.listContextPacks('workspace-1')).resolves.toHaveLength(1);
    await expect(client.listProviderConnections('workspace-1')).resolves.toHaveLength(1);
    await expect(client.testProviderConnection('csrf', 'conn-1')).resolves.toMatchObject({ ok: true });
    await expect(client.createModel('csrf', {})).resolves.toMatchObject({ id: 'model-1' });
    await expect(client.listModels('workspace-1')).resolves.toHaveLength(1);
    await expect(client.createProfile('csrf', {})).resolves.toMatchObject({ name: 'Profile' });
    await expect(client.listProfiles('workspace-1')).resolves.toHaveLength(1);
    await expect(client.listWorkflows('workspace-1')).resolves.toHaveLength(1);
    await expect(client.report('run-1')).resolves.toMatchObject({ title: 'Title' });
    await expect(client.exportReport('run-1', 'markdown')).resolves.toBe('# report');
  });

  it('surfaces server and non-json errors', async () => {
    const client = new ApiClient();
    mockFetch(() => jsonResponse({ message: 'No access' }, 403));
    await expect(client.listProjects('workspace-1')).rejects.toThrow('No access');
    mockFetch(() => jsonResponse({}, 500));
    await expect(client.listProjects('workspace-1')).rejects.toThrow('Request failed with 500');
    mockFetch(() => textResponse('broken', 500));
    await expect(client.listProjects('workspace-1')).rejects.toThrow('Request failed with 500');
    await expect(client.exportReport('run-1', 'html')).rejects.toThrow('Request failed with 500');
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
    verified: true
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
