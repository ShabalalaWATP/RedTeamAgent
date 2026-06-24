import { expect, test, type Page } from '@playwright/test';
import { assertNoWcagViolations } from './stage1-accessibility';
import {
  mockApi,
  modelProfileResponse,
  modelRecordResponse,
  projectResponse,
  providerConnectionResponse,
  signIn
} from './stage1-fixtures';

const auditViewports = [
  { name: 'phone-360', width: 360, height: 780 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'wide-1920', width: 1920, height: 1080 }
] as const;

const colourSchemes = ['dark', 'light'] as const;

const screenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  fullPage: false,
  maxDiffPixelRatio: 0.02
} as const;

const seededApi = {
  initialProjects: [projectResponse()],
  providerConnections: [providerConnectionResponse()],
  modelRecords: [modelRecordResponse()],
  modelProfiles: [modelProfileResponse()]
};

test('stage 1 screens have accessibility coverage and visual baselines', async ({ page }) => {
  await mockApi(page, seededApi);
  await page.emulateMedia({ colorScheme: 'dark' });
  await verifyVisualJourney(page, '');
  await page.emulateMedia({ colorScheme: 'light' });
  await verifyVisualJourney(page, '-light');
});

async function verifyVisualJourney(page: Page, suffix: string) {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();
  await verifyScreen(page, `auth${suffix}`);

  await signIn(page);
  await expect(page.getByText('Stage 1 launch review')).toBeVisible();
  await verifyScreen(page, `dashboard${suffix}`);

  await page.getByRole('link', { name: 'New review' }).click();
  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByRole('button', { name: 'Create review' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await verifyScreen(page, `new-review${suffix}`);

  await page.goto('/runs/run-1');
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByLabel('Findings').getByText('Unsupported claim risk')).toBeVisible();
  await verifyScreen(page, `report${suffix}`);

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await verifyScreen(page, `workflows${suffix}`);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI providers' })).toBeVisible();
  await expect(page.getByText('manual · verified')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Model comparison' }).getByText('fake-reviewer')).toBeVisible();
  await verifyScreen(page, `settings${suffix}`);
}

test('stage 1 screens pass WCAG and responsive layout matrix', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The audit matrix sets explicit viewport sizes.');
  await mockApi(page, seededApi);

  for (const colourScheme of colourSchemes) {
    await page.emulateMedia({ colorScheme: colourScheme });
    for (const viewport of auditViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await auditAuth(page);
      await auditDashboard(page);
      await auditNewReview(page);
      await auditReport(page);
      await auditWorkflows(page);
      await auditSettings(page);
    }
  }
});

async function verifyScreen(page: Page, name: string) {
  await assertNoWcagViolations(page);
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(`${name}.png`, screenshotOptions);
}

async function auditCurrentScreen(page: Page) {
  await assertNoWcagViolations(page);
  await expectNoHorizontalOverflow(page);
}

async function auditAuth(page: Page) {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'RedTeamAgent' })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditDashboard(page: Page) {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditNewReview(page: Page) {
  await page.goto('/projects/project-1/reviews/new');
  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByRole('button', { name: 'Create review' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditReport(page: Page) {
  await page.goto('/runs/run-1');
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByLabel('Findings').getByText('Unsupported claim risk')).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditWorkflows(page: Page) {
  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await auditCurrentScreen(page);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return Math.max(0, root.scrollWidth - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(4);
}
