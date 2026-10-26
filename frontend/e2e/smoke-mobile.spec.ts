import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Phone-width layout check (PRD 8.2, 375px): no page of the customer, owner or admin portal may scroll sideways.
 * Signs in through the API (the refresh cookie lands in the browser context), then visits every route.
 * The owner account's workshop is rejected afterwards so it never reaches the admin's pending queue.
 */
const API = '/api/v1';
const run = Date.now().toString(36);
const digits = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));

test.skip(({ isMobile }) => !isMobile, 'phone layout only');
test.use({ viewport: { width: 375, height: 812 } }); // PRD 8.2 mobile width (the Pixel 7 profile alone is 412px)
test.describe.configure({ mode: 'serial' });

async function noSideScroll(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
    expect(sw, `${route} scrolls sideways (${sw}px content in a ${vw}px screen)`).toBeLessThanOrEqual(vw);
  }
}

async function post(req: APIRequestContext, path: string, data: object) {
  const res = await req.post(`${API}${path}`, { data });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

let ownerWorkshopId = '';

test.afterAll(async ({ playwright, baseURL }) => {
  if (!ownerWorkshopId) return;
  const req = await playwright.request.newContext({ baseURL });
  const login = await req.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  if (login.ok()) {
    const headers = { Authorization: `Bearer ${(await login.json()).data.access_token}` };
    await req.patch(`${API}/admin/workshops/${ownerWorkshopId}/approval`, { headers, data: { action: 'REJECT', reason: 'Data uji E2E otomatis' } });
  }
  await req.dispose();
});

test('customer pages fit a 375px phone', async ({ page }) => {
  await post(page.request, '/auth/register/customer', { name: 'Pelanggan Mobile E2E', email: `cust.m.${run}@example.test`, phone: `0816${digits()}`, password: `E2eCust${run}A1` });
  await noSideScroll(page, ['/', '/workshops', '/emergency', '/orders', '/vehicles', '/notifications', '/akun']);
});

test('owner portal fits a 375px phone', async ({ page }) => {
  const s = await post(page.request, '/auth/register/workshop', {
    owner: { name: 'Pemilik Mobile E2E', email: `owner.m.${run}@example.test`, phone: `0812${digits()}`, password: `E2eOwner${run}A1` },
    workshop: {
      name: `Bengkel Mobile E2E ${run}`,
      address: 'Jl. Uji Tata Letak No. 2',
      phone: `0813${digits()}`,
      latitude: -6.2,
      longitude: 106.82,
      vehicle_types: ['MOTOR', 'MOBIL'],
      open_time: '08:00',
      close_time: '17:00',
      max_slot_per_hour: 3,
    },
  });
  ownerWorkshopId = (await (await page.request.get(`${API}/workshops/me`, { headers: { Authorization: `Bearer ${s.access_token}` } })).json()).data.id;
  await noSideScroll(page, ['/owner', '/owner/emergency', '/owner/orders', '/owner/quotas', '/owner/mechanics', '/owner/payments', '/owner/reviews', '/owner/profile', '/owner/profile#jadwal', '/owner/profile#foto', '/owner/notifications', '/owner/akun']);
});

test('admin portal fits a 375px phone', async ({ page }) => {
  await post(page.request, '/auth/login', { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD });
  await noSideScroll(page, ['/admin', '/admin/workshops', '/admin/reports', '/admin/users', '/admin/search?q=Bengkel', '/admin/audit', '/admin/health', '/admin/notifications', '/admin/akun']);
});
