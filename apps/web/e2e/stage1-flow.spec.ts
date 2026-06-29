import { Buffer } from 'node:buffer';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { assertNoWcagViolations } from './stage1-accessibility';
import { mockApi } from './stage1-fixtures';
import { reviewResponse } from './stage-fixture-data';

const validPassword = 'Correct-Horse-42!'; // noqa: S105
const apiHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRF-Token',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'content-type': 'application/json'
};

test('stage 2 browser flow reaches evidence-linked report', async ({ page }) => {
  await mockApi(page, { initialProjects: [] });
  await mockReviewUpdate(page);
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'TheAllSeeingEye' })).toBeVisible();

  await assertNoWcagViolations(page);
  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill(validPassword);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify email' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Start workflow' }).click();

  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByLabel('Title').fill('Checkout provider migration');
  await page.getByLabel('Proposal').fill('Launch the new checkout provider with staged validation and rollback criteria.');
  await page.getByRole('button', { name: 'Next stage' }).click();

  await expect(page.getByRole('heading', { name: 'Sources and snapshots' })).toBeVisible();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(page.getByText('proposal.txt')).toBeVisible();
  await page.getByLabel('Upload rich evidence').setInputFiles({
    name: 'launch-notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Launch notes\nRollback rehearsals are required.')
  });
  await expect(page.getByText('launch-notes.md')).toBeVisible();
  await page.getByRole('button', { name: 'Snapshot website' }).click();
  await expect(page.getByText('example.com.html')).toBeVisible();
  await page.getByRole('button', { name: 'Ingest repository' }).click();
  await expect(page.getByText('repo.repo.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();

  await expect(page.getByRole('heading', { name: 'Context packs' })).toBeVisible();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();

  await expect(page.getByRole('heading', { name: 'Research policy' })).toBeVisible();
  await page.getByLabel('Enable external research for this review').check();
  await page.getByLabel('Domain allow-list').fill('example.com');
  await expect(page.getByLabel('Domain allow-list')).toHaveValue('example.com');
  await page.getByRole('button', { name: 'Next stage' }).click();

  await expect(page.getByRole('heading', { name: 'Run review' })).toBeVisible();
  await page.getByRole('button', { name: 'Run review' }).click();
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByLabel('Findings').getByText('Unsupported claim risk')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk matrix' })).toBeVisible();
  await expect(page.getByText('Assign validation owner')).toBeVisible();
  await expect(page.getByText('Stage 1 governance context')).toBeVisible();
  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(page.getByLabel('Export output')).toContainText('Evidence-linked report');
  await page.getByRole('button', { name: 'PDF' }).click();
  await expect(page.getByLabel('Export output')).toContainText('PDF export generated');
  await page.getByLabel('Other run ID').fill('run-previous');
  await page.getByRole('button', { name: 'Compare reports' }).click();
  await expect(page.getByText('Prior launch risk removed')).toBeVisible();
  await page.getByRole('link', { name: 'Workflows' }).click();
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await expect(page.getByText('cybersecurity_privacy')).toBeVisible();
  await expect(page.getByRole('link', { name: /open workflow/i })).toHaveAttribute('href', '/runs/run-1');
});

test('stage 2 core workflow is keyboard operable', async ({ page }) => {
  await mockApi(page, { initialProjects: [] });
  await mockReviewUpdate(page);
  await mockVisibleProviderAdapters(page);
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'TheAllSeeingEye' })).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill(validPassword);
  await tabTo(page, page.getByRole('button', { name: 'Create an account' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Create account' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText(/check your email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify email' })).toHaveCount(0);
  await tabTo(page, page.getByRole('button', { name: 'Back to sign in' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Sign in' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();

  await tabTo(page, page.getByRole('button', { name: 'Start workflow' }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByLabel('Title').fill('Keyboard checkout review');
  await page.getByLabel('Proposal').fill('Launch the new checkout provider with staged validation and rollback criteria.');
  await tabTo(page, page.getByRole('button', { name: 'Next stage' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sources and snapshots' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Add pasted text' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('proposal.txt')).toBeVisible();
  await tabTo(page, page.getByLabel('Upload rich evidence'));
  await tabTo(page, page.getByRole('button', { name: 'Next stage' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Context packs' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Add context pack' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Next stage' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Research policy' })).toBeVisible();
  await tabTo(page, page.getByLabel('Enable external research for this review'));
  await page.keyboard.press('Space');
  await page.getByLabel('Domain allow-list').fill('example.com');
  await expect(page.getByLabel('Domain allow-list')).toHaveValue('example.com');
  await tabTo(page, page.getByRole('button', { name: 'Next stage' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Run review' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Run review' }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByLabel('Findings').getByText('Unsupported claim risk')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'medium' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('link', { name: 'Workflows' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  await tabTo(page, page.getByRole('link', { name: 'Settings' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI setup' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Load models' }));
  await page.keyboard.press('Enter');
  const providerForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Connect an AI provider' }) });
  await expect(providerForm.getByLabel('Model', { exact: true })).toHaveValue('gpt-5.5');
  await tabTo(page, page.getByRole('button', { name: 'Test and save' }));
});

async function tabTo(page: Page, target: Locator, maxTabs = 40) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function mockReviewUpdate(page: Page) {
  await page.route('http://localhost:8000/reviews/review-1', async (route) => {
    const request = route.request();
    if (request.method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify(reviewResponse({ project_id: null, ...body }))
    });
  });
}

async function mockVisibleProviderAdapters(page: Page) {
  await page.route('http://localhost:8000/providers/adapters', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify([
        {
          key: 'openai',
          label: 'OpenAI',
          fields: [
            { name: 'api_key', label: 'API key', secret: true, required: true, input_type: 'password' }
          ],
          default_capabilities: ['text', 'structured_output', 'streaming'],
          catalogue_models: [
            { model_identifier: 'gpt-5.5', capabilities: ['text', 'structured_output', 'streaming'] }
          ]
        }
      ])
    });
  });
  await page.route('http://localhost:8000/providers/models/preview', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify([
        { model_identifier: 'gpt-5.5', capabilities: ['text', 'structured_output', 'streaming'] }
      ])
    });
  });
}
