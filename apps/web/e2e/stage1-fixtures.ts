import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Route } from '@playwright/test';

const apiHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRF-Token',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'content-type': 'application/json'
};

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
    if (url.pathname === '/auth/password-reset/request') {
      await fulfilJson(route, authResponse({ reset_token: 'reset-local' }));
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
    if (url.pathname === '/reviews/review-1/sources/text') {
      await fulfilJson(route, sourceResponse());
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
    await route.fulfill({ status: 404, headers: apiHeaders, body: '{"message":"Not mocked"}' });
  });
}

export async function signIn(page: Page) {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
}

export async function assertNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
  expect(serious).toEqual([]);
}

export function projectResponse() {
  return {
    id: 'project-1',
    workspace_id: 'workspace-1',
    title: 'Stage 1 launch review',
    description: 'Assess product, security, legal and delivery risk.'
  };
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

function updatedProjectResponse() {
  return {
    ...projectResponse(),
    title: 'Launch decision review',
    description: 'Updated decision scope.'
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

function contextPackResponse() {
  return {
    id: 'context-1',
    workspace_id: 'workspace-1',
    name: 'Stage 1 governance context',
    agent_key: 'policy_governance',
    markdown: '# Governance\nUse source-linked claims and show assumptions.',
    version: 1
  };
}

function preflightResponse() {
  return {
    selected_agents: ['cybersecurity_privacy', 'operations_delivery'],
    excluded_agents: ['legal_regulatory'],
    provider_route: 'fake.valid',
    warnings: []
  };
}

function runResponse(state = 'completed') {
  return {
    id: 'run-1',
    workspace_id: 'workspace-1',
    review_id: 'review-1',
    state,
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
    context_packs: [
      {
        id: 'context-1',
        name: 'Stage 1 governance context',
        agent_key: 'policy_governance',
        version: 1,
        markdown_sha256: 'abcdef1234567890'
      }
    ],
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

function adapterSchemas() {
  return [
    {
      key: 'fake',
      label: 'Fake local provider',
      fields: [{ name: 'scenario', label: 'Scenario', secret: false, required: true, input_type: 'text' }],
      default_capabilities: ['text', 'structured_output', 'streaming']
    }
  ];
}

export function providerConnectionResponse() {
  return {
    id: 'provider-1',
    workspace_id: 'workspace-1',
    adapter: 'fake',
    name: 'Fake local provider',
    config: { scenario: 'valid' },
    has_credentials: false
  };
}

export function modelRecordResponse() {
  return {
    id: 'model-1',
    workspace_id: 'workspace-1',
    provider_connection_id: 'provider-1',
    model_identifier: 'fake-reviewer',
    capabilities: ['text', 'structured_output', 'streaming'],
    provenance: 'manual',
    verified: true
  };
}

export function modelProfileResponse() {
  return {
    id: 'profile-1',
    workspace_id: 'workspace-1',
    name: 'Default evidence profile',
    agent_key: 'evidence_context',
    model_record_id: 'model-1',
    explicit_pin: true
  };
}
