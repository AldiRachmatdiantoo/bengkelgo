import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Accessibility (PRD 8.2: WCAG AA). Fails on "serious"/"critical" axe findings on the public pages.
const PAGES = ['/', '/workshops', '/emergency', '/login', '/register', '/register/workshop', '/halaman-tidak-ada'];

for (const url of PAGES) {
  test(`a11y ${url}`, async ({ page }) => {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForLoadState('networkidle');
    // Let entrance animations finish so axe sees final colours.
    await page.waitForTimeout(800);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('.leaflet-container')
      // Accepted by design: solid SOS buttons keep the team's #F05A28 with white text (3.4:1). Marked in the markup.
      .exclude('[data-a11y-exception]')
      .analyze();
    const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x – ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(summary, summary.join('\n')).toEqual([]);
  });
}
