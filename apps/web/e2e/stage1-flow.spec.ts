import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const apiHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRF-Token',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'content-type': 'application/json'
};

async function fulfilJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers: apiHeaders, body: JSON.stringify(body) });
}

async function mockApi(page: Page) {
  await page.route('http://localhost:8000/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
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
    if (url.pathname === '/projects' && request.method() === 'GET') {
      await fulfilJson(route, []);
      return;
    }
    if (url.pathname === '/projects' && request.method() === 'POST') {
      await fulfilJson(route, projectResponse());
      return;
    }
    if (url.pathname === '/projects/project-1/reviews') {
      await fulfilJson(route, reviewResponse());
      return;
    }
    if (url.pathname === '/reviews/review-1/sources/text') {
      await fulfilJson(route, sourceResponse());
      return;
    }
    if (url.pathname === '/context-packs') {
      await fulfilJson(route, { id: 'context-1', version: 1 });
      return;
    }
    if (url.pathname === '/reviews/review-1/preflight') {
      await fulfilJson(route, {
        selected_agents: ['cybersecurity_privacy', 'operations_delivery'],
        excluded_agents: ['legal_regulatory'],
        provider_route: 'fake.valid',
        warnings: []
      });
      return;
    }
    if (url.pathname === '/reviews/review-1/runs') {
      await fulfilJson(route, runResponse());
      return;
    }
    if (url.pathname === '/runs/run-1/events') {
      await fulfilJson(route, runEvents());
      return;
    }
    if (url.pathname === '/runs/run-1/report') {
      await fulfilJson(route, { data: reportResponse() });
      return;
    }
    if (url.pathname === '/runs/run-1/report/export') {
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
    await route.fulfill({ status: 404, headers: apiHeaders, body: '{"message":"Not mocked"}' });
  });
}

test('stage 1 browser flow reaches evidence-linked report', async ({ page }) => {
  await mockApi(page);
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();

  await assertNoSeriousA11yIssues(page);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByLabel('Verification token')).toHaveValue('verify-local');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: 'New review' }).click();

  await page.getByRole('button', { name: 'Create review' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(page.getByText('proposal.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await page.getByRole('button', { name: 'Preflight' }).click();
  await expect(page.getByText('cybersecurity_privacy')).toBeVisible();

  await page.getByRole('button', { name: 'Run review' }).click();
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByText('Unsupported claim risk')).toBeVisible();
  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(page.getByLabel('Export output')).toContainText('Evidence-linked report');
  await page.getByRole('link', { name: 'Workflows' }).click();
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await expect(page.getByRole('link', { name: /open report/i })).toHaveAttribute('href', '/runs/run-1');
});

async function assertNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
  expect(serious).toEqual([]);
}

function authResponse(extra: Record<string, string | null>) {
  return {
    user: { id: 'user-1', email: 'alex@example.com', is_verified: true },
    workspace: { id: 'workspace-1', name: 'Alex Workspace' },
    csrf_token: null,
    verification_token: null,
    reset_token: null,
    ...extra
  };
}

function projectResponse() {
  return {
    id: 'project-1',
    workspace_id: 'workspace-1',
    title: 'Stage 1 launch review',
    description: 'Assess product, security, legal and delivery risk.'
  };
}

function reviewResponse() {
  return {
    id: 'review-1',
    workspace_id: 'workspace-1',
    project_id: 'project-1',
    title: 'Checkout provider migration',
    proposal_text: 'Launch the new checkout provider.',
    mode: 'standard',
    focus_chips: ['security', 'policy', 'UX']
  };
}

function sourceResponse() {
  return {
    id: 'source-1',
    filename: 'proposal.txt',
    content_type: 'text/plain',
    state: 'ingested',
    metadata: { locator: 'source-1:line-1' },
    warnings: []
  };
}

function runResponse() {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    state: 'completed',
    routing_plan: { provider: 'fake', model: 'fake-valid' },
    usage: { tokens: 0 }
  };
}

function runEvents() {
  return [
    { id: 'event-1', state: 'intake', message: 'Sources received.', sequence: 1 },
    { id: 'event-2', state: 'quality_gate', message: 'Structured report passed.', sequence: 2 }
  ];
}

function reportResponse() {
  return {
    title: 'Checkout provider migration',
    provisional_recommendation: 'Proceed with controls.',
    executive_summary: 'Evidence supports a staged rollout with explicit rollback.',
    coverage_map: { sources: 1, agents: ['cybersecurity_privacy'] },
    top_risks: ['Unsupported claim risk'],
    dependencies: ['Support coverage'],
    blockers: [],
    assumptions: ['Traffic can be shifted gradually.'],
    evidence_gaps: ['No load test attached.'],
    findings: [
      {
        id: 'finding-1',
        title: 'Unsupported claim risk',
        summary: 'The proposal needs a cited resilience claim before launch.',
        severity: 'medium',
        confidence: 'medium',
        category: 'evidence',
        agent: 'cybersecurity_privacy',
        evidence_label: 'source-1:line-1'
      }
    ],
    sources: ['proposal.txt'],
    methodology: 'Deterministic fake-provider review with evidence-linked findings.'
  };
}

function workflowResponse() {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    review_title: 'Checkout provider migration',
    project_id: 'project-1',
    project_title: 'Launch decision',
    mode: 'standard',
    state: 'completed',
    created_at: '2026-06-24T00:00:00Z',
    selected_agents: ['cybersecurity_privacy', 'operations_delivery'],
    top_risks: ['Unsupported claim risk'],
    finding_count: 1,
    has_report: true
  };
}
