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

// The app defaults to dark and persists an explicit choice; drive that choice
// the way the UI toggle does (localStorage), read by the pre-paint bootstrap.
async function applyColourScheme(page: Page, scheme: (typeof colourSchemes)[number]) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('rta.theme', value);
    } catch {
      /* ignore storage failures in the test browser */
    }
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
}

test('stage 1 screens have accessibility coverage and visual baselines', async ({ page }) => {
  test.setTimeout(120_000);
  await mockApi(page, seededApi);
  await applyColourScheme(page, 'dark');
  await verifyVisualJourney(page, '');
  await applyColourScheme(page, 'light');
  await verifyVisualJourney(page, '-light');
});

async function verifyVisualJourney(page: Page, suffix: string) {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'TheAllSeeingEye' })).toBeVisible();
  await verifyScreen(page, `auth${suffix}`);

  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByText('Stage 1 launch review')).toBeVisible();
  await verifyScreen(page, `dashboard${suffix}`);

  await page.getByRole('link', { name: 'New review' }).click();
  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(page.getByText('Review created')).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await verifyScreen(page, `new-review${suffix}`);

  await page.goto('/runs/run-1');
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByText('Unsupported claim risk').first()).toBeVisible();
  await verifyScreen(page, `report${suffix}`);

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Previous workflows' })).toBeVisible();
  await expect(page.getByText('Checkout provider migration')).toBeVisible();
  await verifyScreen(page, `workflows${suffix}`);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI setup' })).toBeVisible();
  await expect(page.getByLabel('AI provider')).toBeVisible();
  await expect(page.getByLabel('Display name')).toBeVisible();
  await expect(page.getByText("Load the provider's live model list, then choose the model TheAllSeeingEye should use.")).toBeVisible();
  await expect(page.getByText(/not a URL/i)).toBeVisible();
  await expect(page.getByText('Advanced AI controls')).toBeVisible();
  await expect(page.getByText('Workspace administration')).toHaveCount(0);
  await verifyScreen(page, `settings${suffix}`);
}

test('stage 1 screens pass WCAG and responsive layout matrix', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The audit matrix sets explicit viewport sizes.');
  await mockApi(page, seededApi);

  for (const colourScheme of colourSchemes) {
    await applyColourScheme(page, colourScheme);
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
  // Reset scroll so viewport screenshots are stable after multi-step interactions.
  await page.evaluate(() => window.scrollTo(0, 0));
  // The login eye is a live WebGL canvas; mask it so baselines stay deterministic.
  await expect(page).toHaveScreenshot(`${name}.png`, {
    ...screenshotOptions,
    mask: [page.locator('.evil-eye-container')]
  });
}

async function auditCurrentScreen(page: Page) {
  await assertNoWcagViolations(page);
  await expectNoHorizontalOverflow(page);
}

async function auditAuth(page: Page) {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'TheAllSeeingEye' })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditDashboard(page: Page) {
  await signIn(page);
  await page.getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditNewReview(page: Page) {
  await page.goto('/projects/project-1/reviews/new');
  await expect(page.getByRole('heading', { name: 'New review' })).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();
  await page.getByRole('button', { name: 'Add pasted text' }).click();
  await expect(page.getByText('Review created')).toBeVisible();
  await page.getByRole('button', { name: 'Next stage' }).click();
  await page.getByRole('button', { name: 'Add context pack' }).click();
  await expect(page.getByText('Stage 1 governance context', { exact: true })).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditReport(page: Page) {
  await page.goto('/runs/run-1');
  await expect(page.getByRole('heading', { name: 'Report preview' })).toBeVisible();
  await expect(page.getByText('Unsupported claim risk').first()).toBeVisible();
  await auditCurrentScreen(page);
}

async function auditWorkflows(page: Page) {
  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
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
