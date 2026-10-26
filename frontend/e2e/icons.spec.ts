import { expect, test, type Page } from '@playwright/test';

/**
 * The icon font only contains the icons found in the source at build time (vite.config.ts). An icon that is
 * missing from it renders as its name in plain text ("home_pin"), which is much wider than one glyph. This
 * opens the main pages of every portal and checks that every icon on screen is a single glyph.
 */
const API = '/api/v1';
const run = Date.now().toString(36);
const digits = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

async function iconsShownAsText(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((where) =>
    [...document.querySelectorAll<HTMLElement>('.material-symbols-outlined')]
      .filter((el) => el.offsetParent !== null && el.textContent?.trim())
      .filter((el) => el.getBoundingClientRect().width > parseFloat(getComputedStyle(el).fontSize) * 1.6)
      .map((el) => `${where}: ${el.textContent!.trim()}`),
    path,
  );
}

test.skip(({ isMobile }) => isMobile, 'one viewport is enough for glyph checks');

test('every icon renders as a glyph on public, customer, owner and admin pages', async ({ browser }) => {
  const missing: string[] = [];

  const visitor = await browser.newPage();
  for (const path of ['/', '/workshops', '/workshops?tab=sos', '/emergency', '/login', '/register', '/register/workshop', '/halaman-tidak-ada']) {
    missing.push(...(await iconsShownAsText(visitor, path)));
  }
  await visitor.close();

  const customer = await browser.newPage();
  const c = await customer.request.post(`${API}/auth/register/customer`, { data: { name: 'Pelanggan Ikon', email: `cust.icon.${run}@example.test`, phone: `0816${digits()}`, password: `E2eIcon${run}A1` } });
  expect(c.ok(), await c.text()).toBeTruthy();
  for (const path of ['/orders', '/vehicles', '/notifications', '/verifikasi-email', '/akun']) missing.push(...(await iconsShownAsText(customer, path)));
  await customer.close();

  const owner = await browser.newPage();
  const o = await owner.request.post(`${API}/auth/register/workshop`, {
    data: {
      owner: { name: 'Pemilik Ikon', email: `owner.icon.${run}@example.test`, phone: `0812${digits()}`, password: `E2eIcon${run}A1` },
      workshop: { name: `Bengkel Ikon ${run}`, address: 'Jl. Uji Ikon 1', phone: `0813${digits()}`, latitude: -6.2, longitude: 106.8, vehicle_types: ['MOTOR'], open_time: '08:00', close_time: '17:00', max_slot_per_hour: 2 },
    },
  });
  expect(o.ok(), await o.text()).toBeTruthy();
  const workshopId = (await o.json()).data.workshop.id as string;
  for (const path of ['/owner', '/owner/emergency', '/owner/orders', '/owner/quotas', '/owner/mechanics', '/owner/payments', '/owner/reviews', '/owner/notifications', '/owner/akun', '/owner/profile', '/owner/profile#layanan', '/owner/profile#jadwal', '/owner/profile#foto', '/owner/profile#qris']) {
    missing.push(...(await iconsShownAsText(owner, path)));
  }
  await owner.close();

  const admin = await browser.newPage();
  const a = await admin.request.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  expect(a.ok(), await a.text()).toBeTruthy();
  for (const path of ['/admin', '/admin/workshops', '/admin/reports', '/admin/users', '/admin/search?q=ikon', '/admin/audit', '/admin/health', '/admin/notifications', '/admin/akun']) {
    missing.push(...(await iconsShownAsText(admin, path)));
  }
  // Leave no test workshop waiting for approval.
  const token = (await a.json()).data.access_token as string;
  await admin.request.patch(`${API}/admin/workshops/${workshopId}/approval`, { headers: { Authorization: `Bearer ${token}` }, data: { action: 'REJECT', reason: 'Data uji E2E otomatis' } });
  await admin.close();

  expect([...new Set(missing)]).toEqual([]);
});
