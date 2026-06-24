import { expect, test, type Page } from '@playwright/test';
import {
  assertNoSeriousA11yIssues,
  mockApi,
  modelProfileResponse,
  modelRecordResponse,
  projectResponse,
  providerConnectionResponse,
  signIn
} from './stage1-fixtures';

const screenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  fullPage: false,
  maxDiffPixelRatio: 0.02
} as const;

test('stage 1 screens have accessibility coverage and visual baselines', async ({ page }) => {
  await mockApi(page, {
    initialProjects: [projectResponse()],
    providerConnections: [providerConnectionResponse()],
    modelRecords: [modelRecordResponse()],
    modelProfiles: [modelProfileResponse()]
  });

  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();
  await verifyScreen(page, 'auth');

  await signIn(page);
  await expect(page.getByText('Stage 1 launch review')).toBeVisible();
  await verifyScreen(page, 'dashboard');

  await page.getByRole('link', { name: 'New review' }).click();
  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByRole('button', { name: 'Create review' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await verifyScreen(page, 'new-review');

  await page.goto('/runs/run-1');
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByText('Unsupported claim risk')).toBeVisible();
  await verifyScreen(page, 'report');

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await verifyScreen(page, 'workflows');

  await page.goto('/providers');
  await expect(page.getByRole('heading', { name: 'Provider settings' })).toBeVisible();
  await expect(page.getByText('manual · verified')).toBeVisible();
  await verifyScreen(page, 'providers');
});

async function verifyScreen(page: Page, name: string) {
  await assertNoSeriousA11yIssues(page);
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(`${name}.png`, screenshotOptions);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return Math.max(0, root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(4);
}
