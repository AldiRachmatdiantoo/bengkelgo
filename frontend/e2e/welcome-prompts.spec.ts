import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// A first visit: no stored answers (the config marks every other test as a returning visitor).
test.use({ storageState: { cookies: [], origins: [] } });

async function axe(page: Page) {
  await page.waitForTimeout(500); // modal and bar animations
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('.leaflet-container').analyze();
  return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test('first visit: SOS question, then the cookie notice; both remembered', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Kendaraan Anda mogok sekarang?');
  await expect(page.getByTestId('sos-prompt-motor')).toBeFocused();
  await expect(page.getByTestId('cookie-notice')).toBeHidden();
  expect(await axe(page)).toEqual([]);

  await page.getByTestId('sos-prompt-close').click();
  await expect(dialog).toBeHidden();
  const notice = page.getByTestId('cookie-notice');
  await expect(notice).toContainText('Tidak ada cookie iklan atau pelacak');
  expect(await axe(page)).toEqual([]);
  await page.getByTestId('cookie-accept').click();
  await expect(notice).toBeHidden();

  // Then a pointer to the floating SOS button, sitting right above it.
  const tip = page.getByTestId('sos-tip');
  await expect(tip).toContainText('Ini tombol darurat');
  const [tipBox, sosBox] = [await tip.boundingBox(), await page.getByTestId('nav-sos').boundingBox()];
  expect(tipBox!.y + tipBox!.height).toBeLessThanOrEqual(sosBox!.y);
  expect(tipBox!.x + tipBox!.width).toBeGreaterThanOrEqual(sosBox!.x + sosBox!.width / 2);
  expect(await axe(page)).toEqual([]);
  await page.getByTestId('sos-tip-close').click();
  await expect(tip).toBeHidden();

  await page.reload();
  await page.locator('main').waitFor();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('cookie-notice')).toBeHidden();
  await expect(page.getByTestId('sos-tip')).toBeHidden();
});

test('"Mobil mogok" opens the SOS flow with Mobil chosen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sos-prompt-mobil').click();
  await expect(page).toHaveURL(/\/emergency/);
  // Pick a point on the map, then the workshop step shows the chosen type.
  await page.locator('.leaflet-container').first().click();
  await page.getByTestId('step-next').click();
  await expect(page.getByRole('radio', { name: 'Mobil' })).toHaveAttribute('aria-checked', 'true');
});

test('Escape closes the SOS question', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('cookie-notice')).toBeVisible();
});
