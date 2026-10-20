import { expect, test } from '@playwright/test';

// The GPS button explains first (once), then the browser asks; a refusal shows how to re-allow it.
test('GPS: explanation before the browser prompt, unblock steps after a refusal', async ({ browser }) => {
  // No geolocation permission granted: the browser refuses the request.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/emergency');

  await page.getByTestId('sos-gps').click();
  await expect(page.getByRole('heading', { name: 'Izinkan BengkelGo memakai lokasi Anda' })).toBeVisible();
  await page.getByTestId('geo-explain-continue').click();

  await expect(page.getByRole('heading', { name: 'Izin lokasi sedang diblokir' })).toBeVisible();
  await expect(page.getByTestId('geo-steps').locator('li')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Pilih di peta saja' }).click();
  await expect(page.getByRole('heading', { name: 'Izin lokasi sedang diblokir' })).toBeHidden();

  // The explanation is shown only once per browser.
  await page.getByTestId('sos-gps').click();
  await expect(page.getByRole('heading', { name: 'Izinkan BengkelGo memakai lokasi Anda' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Izin lokasi sedang diblokir' })).toBeVisible();
  await ctx.close();
});

test('GPS: in-app browsers are asked to open the page in Chrome/Safari', async ({ browser }) => {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 330.0',
  });
  const page = await ctx.newPage();
  await page.goto('/emergency');
  await page.getByTestId('sos-gps').click();
  await expect(page.getByRole('heading', { name: 'Buka di Chrome atau Safari' })).toBeVisible();
  await expect(page.getByTestId('geo-copy-link')).toBeVisible();
  await ctx.close();
});
