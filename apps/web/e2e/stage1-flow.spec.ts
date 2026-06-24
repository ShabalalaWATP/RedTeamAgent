import { expect, test } from '@playwright/test';
import { assertNoSeriousA11yIssues, mockApi } from './stage1-fixtures';

test('stage 1 browser flow reaches evidence-linked report', async ({ page }) => {
  await mockApi(page, { initialProjects: [] });
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();

  await assertNoSeriousA11yIssues(page);
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

  await page.getByRole('button', { name: 'Create review' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(page.getByText('proposal.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preflight' }).click();
  await expect(page.getByText('cybersecurity_privacy')).toBeVisible();

  await page.getByRole('button', { name: 'Run review' }).click();
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByText('Unsupported claim risk')).toBeVisible();
  await expect(page.getByText('Stage 1 governance context')).toBeVisible();
  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(page.getByLabel('Export output')).toContainText('Evidence-linked report');
  await page.getByRole('link', { name: 'Workflows' }).click();
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await expect(page.getByRole('link', { name: /open report/i })).toHaveAttribute('href', '/runs/run-1');
});
