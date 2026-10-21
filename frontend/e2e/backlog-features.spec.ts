import path from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Backlog A & B screens against the real backend: saved vehicles, booking with a vehicle, reschedule,
 * status history, cancel reason, SOS category/range, choosing the mechanic, editing the SOS price,
 * transfer reference + invoice, owner reviews & replies, schedule/holidays, photos, admin tools.
 * Accounts and the workshop are created through the API; the test workshop is suspended afterwards.
 */
const API = '/api/v1';
const PHOTO = path.resolve(import.meta.dirname, '../../backend/docs/postman/sample-image.png');
const run = Date.now().toString(36);
const digits = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));
const tomorrow = () => new Date(Date.now() + 7 * 3600e3 + 864e5).toISOString().slice(0, 10);
const LOC = { lat: -6.17, lng: 106.79 };
const workshopName = `Bengkel Fitur E2E ${run}`;
const owner = { name: 'Pemilik Fitur', email: `owner.f.${run}@example.test`, phone: `0812${digits()}`, password: `E2eOwner${run}A1` };
const customer = { name: 'Sinta Fitur', email: `cust.f.${run}@example.test`, phone: `0816${digits()}`, password: `E2eCust${run}A1` };

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop flows');

let ownerCtx: BrowserContext;
let o: Page;
let custCtx: BrowserContext;
let c: Page;
let workshopId = '';
let ownerToken = '';
let adminToken = '';
let bookingId = '';
let sosId = '';

async function data(res: Awaited<ReturnType<APIRequestContext['post']>>) {
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  ownerCtx = await browser.newContext({ geolocation: { latitude: LOC.lat, longitude: LOC.lng }, permissions: ['geolocation'] });
  o = await ownerCtx.newPage();
  custCtx = await browser.newContext({ geolocation: { latitude: LOC.lat + 0.002, longitude: LOC.lng }, permissions: ['geolocation'] });
  c = await custCtx.newPage();

  // Owner + workshop (refresh cookie lands in the owner browser context).
  const reg = await data(
    await o.request.post(`${API}/auth/register/workshop`, {
      data: {
        owner,
        workshop: { name: workshopName, address: 'Jl. Fitur E2E No. 3', phone: `0813${digits()}`, latitude: LOC.lat, longitude: LOC.lng, vehicle_types: ['MOTOR', 'MOBIL'], open_time: '07:00', close_time: '21:00', max_slot_per_hour: 3 },
      },
    }),
  );
  ownerToken = reg.access_token;
  workshopId = reg.workshop.id;
  const auth = { Authorization: `Bearer ${ownerToken}` };
  const admin = await data(await o.request.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } }));
  adminToken = admin.access_token;
  // The admin login above replaced the owner's cookie in this context: sign the owner in again.
  await data(await o.request.post(`${API}/auth/login`, { data: { email: owner.email, password: owner.password } }));
  await data(await o.request.patch(`${API}/admin/workshops/${workshopId}/approval`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { action: 'APPROVE' } }));
  await data(await o.request.post(`${API}/workshops/services`, { headers: auth, data: { name: 'Servis Rutin Fitur', price: 90000, duration_minutes: 60, vehicle_type: 'MOTOR' } }));
  await data(await o.request.post(`${API}/workshops/mechanics`, { headers: auth, data: { name: 'Teknisi Satu', specializations: ['matic'] } }));
  await data(await o.request.post(`${API}/workshops/mechanics`, { headers: auth, data: { name: 'Teknisi Dua', specializations: ['injeksi'] } }));
  await o.request.put(`${API}/workshops/qris`, { headers: auth, multipart: { qris: { name: 'q.png', mimeType: 'image/png', buffer: (await import('node:fs')).readFileSync(PHOTO) } } });

  const signup = await data(await c.request.post(`${API}/auth/register/customer`, { data: customer }));
  // The code email can't be read here; confirm the address the way support would (admin, audited).
  await data(await c.request.patch(`${API}/admin/users/${signup.user.id}/verify-email`, { headers: { Authorization: `Bearer ${adminToken}` } }));
});

test.afterAll(async ({ playwright, baseURL }) => {
  await ownerCtx?.close();
  await custCtx?.close();
  const req = await playwright.request.newContext({ baseURL });
  if (adminToken && workshopId) {
    await req.patch(`${API}/admin/workshops/${workshopId}/approval`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { action: 'SUSPEND', reason: 'Data uji E2E otomatis' } });
  }
  await req.dispose();
});

test('customer: saved vehicle, booking with it, reschedule, history and cancel reason', async () => {
  await c.goto('/vehicles');
  await c.getByTestId('vehicle-add').click();
  await c.getByTestId('vehicle-brand').fill('Honda');
  await c.getByLabel('Model (opsional)').fill('Vario 125');
  await c.getByTestId('vehicle-plate').fill('b 4321 xyz');
  await c.getByTestId('vehicle-save').click();
  await expect(c.getByTestId('vehicle-card')).toContainText('Honda Vario 125');
  await expect(c.getByTestId('vehicle-card')).toContainText('B 4321 XYZ');

  // Booking with the saved vehicle (date picked through ?date=).
  await c.goto(`/workshops/${workshopId}?date=${tomorrow()}`);
  await expect(c.getByTestId('next-slot')).toBeVisible();
  await c.getByRole('radiogroup', { name: 'Pilih layanan' }).getByRole('radio', { name: /Servis Rutin Fitur/ }).click();
  await c.getByRole('radiogroup', { name: 'Pilih jam' }).getByRole('radio', { name: /09:00/ }).first().click();
  await c.getByTestId('booking-vehicle').selectOption({ label: 'Honda Vario 125 (B 4321 XYZ)' });
  await c.getByTestId('booking-submit').click();
  await expect(c).toHaveURL(/\/orders\/[0-9a-f-]+(\/pay)?$/);
  bookingId = c.url().split('/orders/')[1].split('/')[0];
  await c.goto(`/orders/${bookingId}`);
  await expect(c.getByText('Vario 125').first()).toBeVisible();

  // Reschedule to 10:00 the same day.
  await c.getByTestId('reschedule-open').click();
  await c.getByRole('dialog').getByRole('radiogroup', { name: 'Pilih jam' }).getByRole('radio', { name: /10:00/ }).first().click();
  await c.getByTestId('reschedule-confirm').click();
  await expect(c.getByText('Jadwal booking diganti')).toBeVisible();
  await expect(c.getByTestId('status-history')).toContainText('Booking terkonfirmasi');

  // Cancel with a reason: shown on the order and to the workshop.
  await c.getByRole('button', { name: 'Batalkan booking' }).click();
  await c.getByTestId('cancel-reason').fill('Ada urusan keluarga');
  await c.getByTestId('cancel-confirm').click();
  await expect(c).toHaveURL(/\/orders$/);
  await c.goto(`/orders/${bookingId}`);
  await expect(c.getByTestId('booking-hero-text')).toContainText('Dibatalkan oleh pelanggan: Ada urusan keluarga');
  await o.goto('/owner/notifications');
  await expect(o.getByTestId('notif-list')).toContainText(`Pesanan dibatalkan oleh ${customer.name}`);
});

test('SOS: category, range and vehicle; owner picks the mechanic and edits the price; RRN, invoice, review reply', async () => {
  await c.goto('/emergency');
  await c.getByTestId('sos-gps').click();
  await c.getByTestId('sos-vehicle').selectOption({ index: 1 });
  await c.getByRole('button', { name: 'Kunci tertinggal' }).click();
  await c.getByRole('radio', { name: 'Rp100–250rb' }).click();
  await c.getByTestId('sos-submit').click();
  await expect(c).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  sosId = c.url().split('/').pop()!;
  await expect(c.getByTestId('problem-category')).toContainText('Kunci tertinggal');

  // Owner: incoming card shows the customer's range; choose "Teknisi Dua" explicitly.
  await o.goto(`/orders/${sosId}`);
  await expect(o.getByText(/Kisaran biaya pelanggan: Rp\s?100\.000/)).toBeVisible();
  await o.getByTestId('emergency-mechanic').selectOption({ label: 'Teknisi Dua' });
  await o.getByLabel('Estimasi biaya (Rp, opsional)').fill('120000');
  await o.getByTestId('emergency-accept').click();
  await expect(o.getByText('Teknisi Dua').first()).toBeVisible();

  // Price edit while unpaid; the customer is told.
  await o.getByTestId('price-input').fill('140000');
  await o.getByTestId('price-save').click();
  await expect(o.getByText('Estimasi biaya diperbarui')).toBeVisible();
  await c.goto('/notifications');
  await expect(c.getByTestId('notif-list')).toContainText('Estimasi biaya diperbarui bengkel', { timeout: 30_000 });

  // Customer pays with a transfer reference; owner sees it, verifies, invoice appears on the receipt.
  await c.goto(`/orders/${sosId}/pay`);
  await c.getByTestId('proof-input').setInputFiles(PHOTO);
  await c.getByTestId('payer-reference').fill('RRN998877');
  await c.getByTestId('payer-name').fill('Sinta F');
  await c.getByTestId('proof-submit').click();
  await expect(c).toHaveURL(new RegExp(`/orders/${sosId}$`));
  await o.goto(`/orders/${sosId}`);
  await expect(o.getByTestId('proof-payer-reference')).toHaveText('RRN998877');
  await o.getByTestId('payment-verify').first().click();
  await expect(o.getByText('Pembayaran diverifikasi lunas')).toBeVisible();
  await expect(o.getByTestId('invoice-number')).toHaveText(/^INV-\d{8}-\d{6}$/);

  // Finish, review, reply; the reply is public.
  await o.getByRole('button', { name: 'Mulai Kerjakan' }).click();
  await o.getByRole('button', { name: 'Tandai Selesai' }).click();
  await expect(o.getByText('Pesanan ditandai selesai')).toBeVisible();
  const review = await c.request.post(`${API}/reviews`, {
    headers: { Authorization: `Bearer ${(await (await c.request.post(`${API}/auth/refresh`)).json()).data.access_token}` },
    data: { order_id: sosId, rating: 4, comment: 'Cepat datang, mantap' },
  });
  expect(review.ok()).toBeTruthy();
  await o.goto('/owner/reviews');
  const card = o.getByTestId('owner-review').filter({ hasText: 'Cepat datang' });
  await card.getByTestId('review-reply-input').fill('Terima kasih, Kak Sinta!');
  await card.getByTestId('review-reply-save').click();
  await expect(card).toContainText('Balasan Anda');
  await c.goto(`/workshops/${workshopId}`);
  await expect(c.getByTestId('review-reply').first()).toContainText('Terima kasih, Kak Sinta!');
  await expect(c.getByTestId('status-history')).toHaveCount(0); // public page has no order timeline
});

test('owner: schedule, holiday, photos, mechanic photo and deleting a service', async () => {
  await o.goto('/owner/profile#jadwal');
  await o.getByTestId('closed-day-0').click();
  await o.getByTestId('break-toggle').check();
  await o.getByTestId('schedule-save').click();
  await expect(o.getByText('Jadwal tersimpan')).toBeVisible();
  await o.getByTestId('holiday-date').fill(new Date(Date.now() + 7 * 3600e3 + 10 * 864e5).toISOString().slice(0, 10));
  await o.getByTestId('holiday-add').click();
  await expect(o.getByTestId('holiday-list')).not.toContainText('Belum ada hari libur');
  // The public availability now marks the break as not bookable.
  const slots = await (await o.request.get(`${API}/workshops/${workshopId}/availability`, { params: { date: tomorrow() } })).json();
  expect(slots.data.find((s: { time_slot: string }) => s.time_slot === '12:00')).toMatchObject({ bookable: false, unavailable_reason: 'DURING_BREAK' });

  await o.goto('/owner/profile#foto');
  await o.getByTestId('photo-input').setInputFiles(PHOTO);
  await o.getByTestId('photo-upload').click();
  await expect(o.getByTestId('photo-grid')).toContainText('Sampul');
  await c.goto(`/workshops/${workshopId}`);
  await expect(c.getByTestId('workshop-photos').locator('img')).toHaveCount(1);

  await o.goto('/owner/mechanics');
  await o.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Satu' }).getByTestId('mechanic-photo-input').setInputFiles(PHOTO);
  await expect(o.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Satu' }).getByTestId('mechanic-photo')).toBeVisible();

  await o.goto('/owner/profile#layanan');
  const row = o.locator('tr').filter({ hasText: 'Servis Rutin Fitur' });
  await row.getByTestId('service-delete').click();
  await o.getByTestId('service-delete-confirm').click();
  await expect(o.locator('tr').filter({ hasText: 'Servis Rutin Fitur' })).toHaveCount(0);
});

test('admin: live stats, search, audit log and system health', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await data(await a.request.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } }));
  await a.goto('/admin');
  await expect(a.getByTestId('admin-live-stats')).toContainText('SOS berjalan');

  const order = await (await a.request.get(`${API}/orders/${sosId}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  await a.getByTestId('admin-search-input').fill(order.data.order_number);
  await a.getByTestId('admin-search-input').press('Enter');
  await expect(a.getByTestId('admin-search-results')).toContainText(order.data.order_number);

  await a.goto('/admin/audit');
  await expect(a.getByTestId('audit-table')).toContainText('Memverifikasi pembayaran');
  await expect(a.getByTestId('audit-table')).toContainText('Mengubah estimasi biaya SOS');

  await a.goto('/admin/health');
  await expect(a.getByTestId('health-list')).toContainText('Database');
  await expect(a.getByText('Semua layanan berjalan normal.')).toBeVisible();

  // Access management: switch the test customer off (login refused), then on again.
  await a.goto('/admin/users');
  await a.getByTestId('users-search').fill(customer.email);
  await a.getByTestId('users-search').press('Enter');
  const row = a.getByTestId('users-table').locator('tr').filter({ hasText: customer.name });
  await row.getByTestId('user-toggle').click();
  await a.getByTestId('user-toggle-confirm').click();
  await expect(row).toContainText('Nonaktif');
  expect((await a.request.post(`${API}/auth/login`, { data: { email: customer.email, password: customer.password } })).status()).toBe(403);
  await row.getByTestId('user-toggle').click();
  await a.getByTestId('user-toggle-confirm').click();
  await expect(row).toContainText('Aktif');
  await ctx.close();
});

test('new customer: code page after sign-up, booking waits for a confirmed email, admin can confirm by hand', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const email = `cust.verify.${Date.now()}@example.test`;
  await p.goto('/register');
  await p.locator('#reg-name').fill('Pelanggan Verifikasi');
  await p.locator('#reg-email').fill(email);
  await p.locator('#reg-phone').fill(`0817${String(Date.now()).slice(-8)}`);
  await p.locator('#reg-password').fill('Verifikasi123');
  await p.getByRole('button', { name: 'Daftar' }).click();

  await expect(p).toHaveURL(/\/verifikasi-email$/);
  await expect(p.getByText(`Kami mengirim kode 6 angka ke ${email}`)).toBeVisible();
  await expect(p.getByTestId('verify-resend')).toBeDisabled(); // just sent: wait before asking again
  await p.getByTestId('verify-code').fill('000000');
  await p.getByTestId('verify-submit').click();
  await expect(p.getByRole('alert').filter({ hasText: 'Kode belum tepat' })).toBeVisible();

  // Skip for now: the reminder strip follows, and booking leads back to the code page.
  await p.getByTestId('verify-later').click();
  await expect(p.getByTestId('verify-email-strip')).toBeVisible();

  // Support confirms the address (the strip disappears after the next sign-in refresh).
  const users = await data(await p.request.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` }, params: { q: email } }));
  await data(await p.request.patch(`${API}/admin/users/${users[0].id}/verify-email`, { headers: { Authorization: `Bearer ${adminToken}` } }));
  await p.reload();
  await expect(p.getByTestId('verify-email-strip')).toBeHidden();
  await ctx.close();
});

test('portal dark mode: light by default, the switch is remembered, the public site stays light', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await data(await a.request.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } }));
  await a.goto('/admin');
  const isDark = () => a.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  const toggle = a.getByTestId('theme-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await isDark()).toBe(false);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await isDark()).toBe(true);
  await a.reload();
  await expect(a.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true');

  await a.goto('/');
  expect(await isDark()).toBe(false);
  await a.goto('/admin');
  await a.getByTestId('theme-toggle').click(); // back to light for other tests in this browser
  expect(await isDark()).toBe(false);
  await ctx.close();
});
