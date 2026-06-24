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
