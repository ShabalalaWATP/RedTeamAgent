import { Buffer } from 'node:buffer';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { assertNoWcagViolations } from './stage1-accessibility';
import { mockApi } from './stage1-fixtures';

test('stage 2 browser flow reaches evidence-linked report', async ({ page }) => {
  await mockApi(page, { initialProjects: [] });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();

  await assertNoWcagViolations(page);
  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByLabel('Verification token')).toHaveValue('verify-local');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Edit project title').fill('Launch decision review');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Launch decision review')).toBeVisible();
  await page.getByRole('link', { name: 'New review' }).click();

  await page.getByLabel('Enable external research for this review').check();
  await page.getByLabel('Domain allow-list').fill('example.com');
  await page.getByRole('button', { name: 'Create review' }).click();
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
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preflight' }).click();
  await expect(page.getByText('cybersecurity_privacy')).toBeVisible();
  await expect(page.getByText('domain_allowlist')).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await expect(page.getByRole('link', { name: /open report/i })).toHaveAttribute('href', '/runs/run-1');
});

test('stage 2 core workflow is keyboard operable', async ({ page }) => {
  await mockApi(page, { initialProjects: [] });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await tabTo(page, page.getByRole('button', { name: 'Register' }));
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Verification token')).toHaveValue('verify-local');

  await tabTo(page, page.getByRole('button', { name: 'Verify email' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Log in' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();

  await tabTo(page, page.getByRole('button', { name: 'Create project' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Stage 1 launch review')).toBeVisible();
  await tabTo(page, page.getByRole('link', { name: 'New review' }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Create review' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Add pasted text' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByLabel('Upload rich evidence'));
  await tabTo(page, page.getByRole('button', { name: 'Add context pack' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Preflight' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('cybersecurity_privacy')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Run review' }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByLabel('Findings').getByText('Unsupported claim risk')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'medium' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('link', { name: 'Workflows' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await tabTo(page, page.getByRole('link', { name: 'Settings' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI providers' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Test and save' }));
});

async function tabTo(page: Page, target: Locator, maxTabs = 40) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}
