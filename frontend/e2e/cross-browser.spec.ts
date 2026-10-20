import { expect, test, type Page } from '@playwright/test';

/**
 * Cross-browser check (PRD 8.2): the public pages and the browser-only features (photo shrinking on a
 * canvas, Web Crypto for Google PKCE) must work in Chromium, Firefox, WebKit/Safari and mobile Safari.
 * Read-only: creates no data and makes no login calls (so it never touches the auth rate limit).
 */
const API = '/api/v1';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function noSideScroll(page: Page) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(sw, `content ${sw}px wider than the ${vw}px screen`).toBeLessThanOrEqual(vw);
}

test('landing and search pages render', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await noSideScroll(page);
  await page.goto('/workshops');
  await expect(page.getByTestId('search-input').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('workshop page shows dates and hourly slots', async ({ page }) => {
  const errors = trackErrors(page);
  const list = await (await page.request.get(`${API}/workshops`, { params: { limit: 1 } })).json();
  test.skip(!list.data?.length, 'no approved workshop in this database');
  const ws = list.data[0] as { id: string; name: string };
  await page.goto(`/workshops/${ws.id}`);
  await expect(page.getByText(ws.name).first()).toBeVisible();
  await expect(page.getByTestId('booking-submit')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('SOS page loads the map and lets you drop a pin', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/emergency');
  const map = page.locator('.leaflet-container').first();
  await expect(map).toBeVisible();
  await map.click();
  await expect(page.getByTestId('sos-guest-name')).toBeVisible();
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('login page renders without the Google button when no client id is configured', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await expect(page.getByTestId('login-email')).toBeVisible();
  await expect(page.getByTestId('google-login')).toHaveCount(process.env.VITE_GOOGLE_CLIENT_ID ? 1 : 0);
  expect(errors).toEqual([]);
});

test('browser features: photo shrinking on canvas and PKCE hashing', async ({ page }) => {
  await page.goto('/login');
  const r = await page.evaluate(async () => {
    const img = await import('/src/utils/imageUpload.ts');
    const oauth = await import('/src/services/auth/googleOAuth.ts');
    // ~3 MB of random noise as PNG, like an uncompressed phone screenshot.
    const c = document.createElement('canvas');
    c.width = c.height = 1000;
    const ctx = c.getContext('2d')!;
    const data = ctx.createImageData(1000, 1000);
    for (let i = 0; i < data.data.length; i++) data.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    ctx.putImageData(data, 0, 0);
    let blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
    if (blob.size <= img.MAX_UPLOAD_BYTES) blob = new Blob([blob, new Uint8Array(img.MAX_UPLOAD_BYTES)], { type: 'image/png' }); // padded PNGs still decode
    const out = await img.prepareImage(new File([blob], 'besar.png', { type: 'image/png' }));
    let videoMessage = '';
    try {
      await img.prepareImage(new File([new Uint8Array(32)], 'klip.mov', { type: 'video/quicktime' }));
    } catch (e) {
      videoMessage = (e as Error).message;
    }
    return {
      before: blob.size,
      after: out.file.size,
      type: out.file.type,
      changed: out.changed,
      videoMessage,
      challenge: await oauth.codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    };
  });
  expect(r.before).toBeGreaterThan(2 * 1024 * 1024);
  expect(r.changed).toBe(true);
  expect(r.type).toBe('image/jpeg');
  expect(r.after).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(r.videoMessage).toMatch(/Video tidak bisa/);
  expect(r.challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
