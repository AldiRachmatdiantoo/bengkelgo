import { expect, test, type Page } from '@playwright/test';

/**
 * Visual regression (PRD 8.2): screenshots of pages whose look should only change on purpose, compared
 * with the approved baselines in e2e/visual.spec.ts-snapshots/. Data-driven parts (maps, live numbers,
 * reviews, workshop lists) are masked so only the design is compared.
 *
 * After an intended design change: `npm run test:visual:update`, check the new PNGs, commit them.
 * Baselines are per OS (file suffix -win32 / -linux): fonts render differently, so CI on Linux needs its own.
 */
const PAGES: { name: string; url: string; mask?: string[]; fullPage?: boolean }[] = [
  { name: 'landing', url: '/', mask: ['[data-testid="platform-numbers"]', '[data-testid="real-reviews"]', 'img'] },
  { name: 'login', url: '/login', fullPage: true },
  { name: 'register', url: '/register', fullPage: true },
  { name: 'register-workshop', url: '/register/workshop', mask: ['.leaflet-container'], fullPage: true },
  { name: 'emergency', url: '/emergency', mask: ['.leaflet-container'], fullPage: true },
  { name: 'not-found', url: '/halaman-tidak-ada', fullPage: true },
];

async function settle(page: Page) {
  await page.locator('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700); // entrance fade
}

for (const p of PAGES) {
  test(`visual ${p.name}`, async ({ page }) => {
    await page.goto(p.url);
    await settle(page);
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: p.fullPage ?? false,
      animations: 'disabled',
      caret: 'hide',
      mask: (p.mask ?? []).map((s) => page.locator(s)),
      maxDiffPixelRatio: 0.01,
    });
  });
}
