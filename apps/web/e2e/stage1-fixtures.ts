import { expect, type Page, type Route } from '@playwright/test';
import {
  adapterSchemas,
  authResponse,
  contextPackResponse,
  evaluationResponse,
  enterpriseAuditResponse,
  enterpriseMembersResponse,
  enterpriseNotificationsResponse,
  enterpriseOperationsResponse,
  governanceResponse,
  modelComparisonResponse,
  modelProfileResponse,
  modelRecordResponse,
  projectResponse,
  providerConnectionResponse,
  preflightResponse,
  reportResponse,
  reviewResponse,
  runEvents,
  runResponse,
  sourceResponse,
  updatedProjectResponse,
  workflowResponse
} from './stage-fixture-data';

const apiHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRF-Token',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'content-type': 'application/json'
};
const validPassword = 'Correct-Horse-42!';

type MockApiOptions = {
  initialProjects?: ReturnType<typeof projectResponse>[];
  providerConnections?: ReturnType<typeof providerConnectionResponse>[];
  modelRecords?: ReturnType<typeof modelRecordResponse>[];
  modelProfiles?: ReturnType<typeof modelProfileResponse>[];
};

async function fulfilJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers: apiHeaders, body: JSON.stringify(body) });
}

export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const state = {
    projects: options.initialProjects ?? [],
    providerConnections: options.providerConnections ?? [],
    modelRecords: options.modelRecords ?? [],
    modelProfiles: options.modelProfiles ?? []
  };

  await page.route('http://localhost:8000/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    if (url.pathname === '/site-admin/visits' && request.method() === 'POST') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    if (url.pathname === '/auth/captcha/challenge') {
      await fulfilJson(route, { required: false, provider: 'disabled', token: '', prompt: '', expires_in_seconds: 0 });
      return;
    }
    if (url.pathname === '/auth/register') {
      await fulfilJson(route, authResponse({ verification_token: 'verify-local' }));
      return;
    }
    if (url.pathname === '/auth/verify-email' || url.pathname === '/auth/logout') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    if (url.pathname === '/auth/login') {
      await fulfilJson(route, authResponse({ csrf_token: 'csrf-local' }));
      return;
    }
    if (url.pathname === '/auth/mfa/status') {
      await fulfilJson(route, { enabled: false });
      return;
    }
    if (url.pathname === '/auth/password-reset/request') {
      await fulfilJson(route, authResponse({ reset_token: 'reset-local' }));
      return;
    }
    if (url.pathname === '/usage/limits') {
      await fulfilJson(route, {
        account_type: 'user',
        tier_name: 'User',
        project_limit: 5,
        projects_used: state.projects.length,
        projects_remaining: Math.max(0, 5 - state.projects.length),
        workflow_total_limit: 20,
        workflows_used: 2,
        workflows_remaining: 18,
        workflow_weekly_limit: 10,
        workflows_started_this_week: 2,
        weekly_workflows_remaining: 8,
        daily_review_run_limit: 20,
        runs_started_today: 2,
        runs_remaining_today: 18,
        resets_at: '2026-06-25T00:00:00Z'
      });
      return;
    }
    if (url.pathname === '/projects' && request.method() === 'GET') {
      await fulfilJson(route, state.projects);
      return;
    }
    if (url.pathname === '/projects' && request.method() === 'POST') {
      const project = projectResponse();
      state.projects = [project, ...state.projects];
      await fulfilJson(route, project);
      return;
    }
    if (url.pathname === '/projects/project-1' && request.method() === 'PUT') {
      const project = updatedProjectResponse();
      state.projects = state.projects.map((item) => (item.id === project.id ? project : item));
      await fulfilJson(route, project);
      return;
    }
    if (url.pathname === '/projects/project-1' && request.method() === 'DELETE') {
      state.projects = state.projects.filter((item) => item.id !== 'project-1');
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    if (url.pathname === '/projects/project-1/reviews') {
      await fulfilJson(route, reviewResponse());
      return;
    }
    if (url.pathname === '/reviews' && request.method() === 'POST') {
      await fulfilJson(route, reviewResponse({ project_id: null }));
      return;
    }
    if (url.pathname === '/reviews/review-1/sources/text') {
      await fulfilJson(route, sourceResponse());
      return;
    }
    if (url.pathname === '/reviews/review-1/sources/upload') {
      await fulfilJson(route, sourceResponse('launch-notes.md'));
      return;
    }
    if (url.pathname === '/reviews/review-1/sources/website') {
      await fulfilJson(route, sourceResponse('example.com.html', 'text/html', { source_kind: 'website' }));
      return;
    }
    if (url.pathname === '/reviews/review-1/sources/repository') {
      await fulfilJson(route, sourceResponse('repo.repo.txt', 'text/plain', { source_kind: 'public_git_repository' }));
      return;
    }
    if (url.pathname === '/context-packs' && request.method() === 'GET') {
      await fulfilJson(route, [contextPackResponse()]);
      return;
    }
    if (url.pathname === '/context-packs' && request.method() === 'POST') {
      await fulfilJson(route, contextPackResponse());
      return;
    }
    if (url.pathname === '/reviews/review-1/preflight') {
      await fulfilJson(route, preflightResponse());
      return;
    }
    if (url.pathname === '/reviews/review-1/runs') {
      await fulfilJson(route, runResponse('intake'));
      return;
    }
    if (url.pathname === '/runs/run-1') {
      await fulfilJson(route, runResponse());
      return;
    }
    if (url.pathname === '/runs/run-1/events') {
      await fulfilJson(route, runEvents());
      return;
    }
    if (url.pathname === '/runs/run-1/events/stream') {
      await route.fulfill({
        status: 200,
        headers: { ...apiHeaders, 'content-type': 'text/event-stream' },
        body: `data: ${JSON.stringify(runEvents()[1])}\n\n`
      });
      return;
    }
    if (url.pathname === '/runs/run-1/report') {
      await fulfilJson(route, { data: reportResponse() });
      return;
    }
    if (url.pathname === '/runs/run-1/report/compare') {
      await fulfilJson(route, {
        left_run_id: 'run-1',
        right_run_id: 'run-previous',
        changed_risks: ['Prior launch risk removed'],
        changed_assumptions: [],
        changed_evidence_gaps: ['New load-test gap'],
        changed_recommendations: []
      });
      return;
    }
    if (url.pathname === '/runs/run-1/report/export') {
      if (url.searchParams.get('fmt') === 'pdf') {
        await route.fulfill({
          status: 200,
          headers: { ...apiHeaders, 'content-type': 'application/pdf' },
          body: '%PDF-1.4 mock'
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...apiHeaders, 'content-type': 'text/markdown' },
        body: '# Evidence-linked report'
      });
      return;
    }
    if (url.pathname === '/workspaces/workspace-1/workflows') {
      await fulfilJson(route, [workflowResponse()]);
      return;
    }
    if (url.pathname === '/providers/adapters') {
      await fulfilJson(route, adapterSchemas());
      return;
    }
    if (url.pathname === '/providers/connections' && request.method() === 'GET') {
      await fulfilJson(route, state.providerConnections);
      return;
    }
    if (url.pathname === '/providers/connections' && request.method() === 'POST') {
      const connection = providerConnectionResponse();
      state.providerConnections = [connection];
      await fulfilJson(route, connection);
      return;
    }
    if (url.pathname === '/providers/connections/provider-1/test') {
      await fulfilJson(route, { status: 'ok' });
      return;
    }
    if (url.pathname === '/providers/connections/provider-1/models/sync') {
      state.modelRecords = [modelRecordResponse()];
      await fulfilJson(route, state.modelRecords);
      return;
    }
    if (url.pathname === '/providers/models' && request.method() === 'GET') {
      await fulfilJson(route, state.modelRecords);
      return;
    }
    if (url.pathname === '/providers/models' && request.method() === 'POST') {
      const model = modelRecordResponse();
      state.modelRecords = [model];
      await fulfilJson(route, model);
      return;
    }
    if (url.pathname === '/providers/models/model-1/probe') {
      const model = modelRecordResponse();
      state.modelRecords = [model];
      await fulfilJson(route, model);
      return;
    }
    if (url.pathname === '/providers/profiles' && request.method() === 'GET') {
      await fulfilJson(route, state.modelProfiles);
      return;
    }
    if (url.pathname === '/providers/profiles' && request.method() === 'POST') {
      const profile = modelProfileResponse();
      state.modelProfiles = [profile];
      await fulfilJson(route, profile);
      return;
    }
    if (url.pathname === '/workspaces/workspace-1/evaluations/stage2') {
      await fulfilJson(route, evaluationResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/governance') {
      await fulfilJson(route, governanceResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/members') {
      await fulfilJson(route, enterpriseMembersResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/audit') {
      await fulfilJson(route, enterpriseAuditResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/notifications') {
      await fulfilJson(route, enterpriseNotificationsResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/operations') {
      await fulfilJson(route, enterpriseOperationsResponse());
      return;
    }
    if (url.pathname === '/enterprise/workspaces/workspace-1/model-comparison') {
      await fulfilJson(route, modelComparisonResponse());
      return;
    }
    if (url.pathname.startsWith('/enterprise/workspaces/workspace-1/')) {
      await fulfilJson(route, {});
      return;
    }
    await route.fulfill({ status: 404, headers: apiHeaders, body: '{"message":"Not mocked"}' });
  });
}

export async function signIn(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill(validPassword);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify email' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
}

export { modelProfileResponse, modelRecordResponse, projectResponse, providerConnectionResponse };
