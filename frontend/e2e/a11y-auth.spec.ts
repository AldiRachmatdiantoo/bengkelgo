import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility (PRD 8.2: WCAG AA) for the pages behind login: customer, workshop owner and admin portals.
// Same rule as a11y.spec.ts: "serious"/"critical" axe findings fail. Accounts are created through the API.
const API = '/api/v1';
const run = Date.now().toString(36);
const digits = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));

test.skip(({ isMobile }) => isMobile, 'desktop only (mobile layout is covered by smoke-mobile.spec.ts)');
test.describe.configure({ mode: 'serial' });

async function audit(page: Page, routes: string[]) {
  const problems: string[] = [];
  for (const url of routes) {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600); // entrance animations
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('.leaflet-container')
      .exclude('[data-a11y-exception]')
      .analyze();
    for (const v of result.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      problems.push(`${url} · ${v.id} (${v.impact}): ${v.nodes.length}x – ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
}

let pendingWorkshopId = '';

test.afterAll(async ({ playwright, baseURL }) => {
  if (!pendingWorkshopId) return;
  const req = await playwright.request.newContext({ baseURL });
  const login = await req.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  if (login.ok()) {
    await req.patch(`${API}/admin/workshops/${pendingWorkshopId}/approval`, {
      headers: { Authorization: `Bearer ${(await login.json()).data.access_token}` },
      data: { action: 'REJECT', reason: 'Data uji E2E otomatis' },
    });
  }
  await req.dispose();
});

test('a11y customer pages', async ({ page }) => {
  const res = await page.request.post(`${API}/auth/register/customer`, {
    data: { name: 'Pelanggan A11y', email: `cust.a11y.${run}@example.test`, phone: `0816${digits()}`, password: `E2eCust${run}A1` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  await audit(page, ['/orders', '/vehicles', '/notifications']);
});

test('a11y workshop owner portal', async ({ page }) => {
  const res = await page.request.post(`${API}/auth/register/workshop`, {
    data: {
      owner: { name: 'Pemilik A11y', email: `owner.a11y.${run}@example.test`, phone: `0812${digits()}`, password: `E2eOwner${run}A1` },
      workshop: { name: `Bengkel A11y ${run}`, address: 'Jl. Uji Aksesibilitas 1', phone: `0813${digits()}`, latitude: -6.2, longitude: 106.8, vehicle_types: ['MOTOR'], open_time: '08:00', close_time: '17:00', max_slot_per_hour: 2 },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  pendingWorkshopId = (await res.json()).data.workshop.id;
  await audit(page, [
    '/owner',
    '/owner/emergency',
    '/owner/orders',
    '/owner/quotas',
    '/owner/mechanics',
    '/owner/payments',
    '/owner/reviews',
    '/owner/profile',
    '/owner/profile#layanan',
    '/owner/profile#jadwal',
    '/owner/profile#foto',
    '/owner/profile#qris',
    '/owner/notifications',
  ]);
});

test('a11y admin portal', async ({ page }) => {
  const res = await page.request.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  expect(res.ok(), await res.text()).toBeTruthy();
  await audit(page, ['/admin', '/admin/workshops', '/admin/reports', '/admin/users', '/admin/search?q=Bengkel', '/admin/audit', '/admin/health', '/admin/notifications']);
});
