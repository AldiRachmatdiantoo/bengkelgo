import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * The two user journeys from PRD 8.2 against the real backend (creates its own data):
 *  2. Owner registers a workshop -> admin approves -> owner configures quota, adds a technician, uploads QRIS.
 *  1. Guest sends an SOS (with a price range) -> workshop accepts with a price -> guest uploads payment proof
 *     -> workshop verifies -> workshop finishes the job.
 * Afterwards the test workshop is suspended so it never shows up for real customers.
 */
const API = '/api/v1';
const PROOF_IMAGE = path.resolve(import.meta.dirname, '../../backend/docs/postman/sample-image.png');
const run = Date.now().toString(36);
const digits = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));
const owner = { name: 'Pemilik E2E', email: `owner.e2e.${run}@example.test`, phone: `0812${digits()}`, password: `E2eOwner${run}A1` };
const workshopName = `Bengkel E2E ${run}`;
let location = { lat: 0, lng: 0 };
let orderId = '';

test.describe.configure({ mode: 'serial' });

let ownerCtx: BrowserContext;
let ownerPage: Page;

async function newPage(browser: Browser, opts: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext(opts);
  return { ctx, page: await ctx.newPage() };
}

test.beforeAll(async ({ browser }) => {
  ({ ctx: ownerCtx, page: ownerPage } = await newPage(browser));
});

test.afterAll(async ({ playwright, baseURL }) => {
  await ownerCtx?.close();
  // Cleanup: suspend the test workshop (there is no delete endpoint).
  const req = await playwright.request.newContext({ baseURL });
  const login = await req.post(`${API}/auth/login`, { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  if (login.ok()) {
    const token = (await login.json()).data.access_token as string;
    const headers = { Authorization: `Bearer ${token}` };
    const list = await (await req.get(`${API}/admin/workshops`, { headers, params: { status: 'APPROVED', limit: 100 } })).json();
    const ws = (list.data as { id: string; name: string }[]).find((w) => w.name === workshopName);
    if (ws) await req.patch(`${API}/admin/workshops/${ws.id}/approval`, { headers, data: { action: 'SUSPEND', reason: 'Data uji E2E otomatis' } });
  }
  await req.dispose();
});

test('journey 2: owner registers, admin approves, owner configures quota, technician and QRIS', async ({ browser }) => {
  const page = ownerPage;
  await page.goto('/register/workshop');
  await page.getByLabel('Nama pemilik').fill(owner.name);
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Nomor WhatsApp').fill(owner.phone);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByLabel('Nama bengkel').fill(workshopName);
  await page.getByLabel('Telepon bengkel').fill(`0813${digits()}`);
  await page.getByLabel('Alamat').fill('Jl. Uji Otomatis No. 1');
  await page.locator('.leaflet-container').click();
  const coords = await page.getByText(/^Koordinat: /).textContent();
  const [lat, lng] = coords!.replace('Koordinat: ', '').split(',').map(Number);
  location = { lat, lng };
  await page.getByRole('button', { name: 'Daftarkan bengkel' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByText('Menunggu verifikasi').first()).toBeVisible();

  // Admin approves the new partner.
  const admin = await newPage(browser);
  await admin.page.goto('/login');
  await admin.page.getByTestId('login-email').fill(process.env.E2E_ADMIN_EMAIL!);
  await admin.page.getByTestId('login-password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await admin.page.getByTestId('login-submit').click();
  await expect(admin.page).toHaveURL(/\/admin$/);
  await admin.page.goto('/admin/workshops');
  const card = admin.page.getByTestId('admin-workshop').filter({ hasText: workshopName });
  await card.getByTestId('admin-approve').click();
  await expect(card).toHaveCount(0);
  await admin.ctx.close();

  // Owner: quota configuration (+1 slot on the first hour of the chosen day).
  await page.goto('/owner/quotas');
  const add = page.getByRole('button', { name: /^Tambah kapasitas/ }).first();
  await expect(add).toBeEnabled();
  const saved = page.waitForResponse((r) => r.url().includes('/workshops/quotas') && r.request().method() === 'PUT');
  await add.click();
  expect((await saved).ok()).toBeTruthy();

  // Technician (needed to accept an SOS) and QRIS (needed to pay).
  await page.goto('/owner/mechanics');
  await page.getByTestId('mechanic-name').fill('Teknisi E2E');
  await page.getByTestId('mechanic-create').click();
  await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi E2E' })).toBeVisible();

  await page.goto('/owner/profile#qris');
  await page.locator('input[type="file"]').setInputFiles(PROOF_IMAGE);
  const qris = page.waitForResponse((r) => r.url().includes('/workshops/qris'));
  await page.getByRole('button', { name: 'Unggah QRIS' }).click();
  expect((await qris).ok()).toBeTruthy();
});

test('journey 1: guest SOS with price range -> accept -> pay -> verify -> complete', async ({ browser }) => {
  const guest = await newPage(browser, { geolocation: { latitude: location.lat, longitude: location.lng }, permissions: ['geolocation'] });
  const g = guest.page;
  await g.goto('/emergency');
  await g.getByTestId('sos-gps').click();
  await g.getByRole('button', { name: 'Ban bocor / pecah' }).click();
  await g.getByRole('radio', { name: 'Rp100–250rb' }).click();
  await g.getByTestId('sos-guest-name').fill('Tamu E2E');
  await g.getByTestId('sos-guest-wa').fill(`0815${digits()}`);
  await g.getByTestId('sos-submit').click();
  await expect(g).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  orderId = g.url().split('/').pop()!;
  await expect(g.getByText(workshopName).first()).toBeVisible();

  // Workshop sees the call (with the customer's range) and accepts with an estimated price.
  const o = ownerPage;
  await o.goto('/owner/emergency');
  const incoming = o.getByTestId('incoming-emergency');
  await expect(incoming).toBeVisible();
  await expect(incoming).toContainText('Kisaran biaya: Rp');
  // Notification from the customer side reached the owner (bell + history page).
  await expect(o.getByTestId('notif-bell')).toContainText(/\d/);
  await o.goto('/owner/notifications');
  await expect(o.getByTestId('notif-list')).toContainText('SOS masuk dari Tamu E2E');
  await o.goto(`/orders/${orderId}`);
  await o.getByLabel('Estimasi biaya (Rp, opsional)').fill('150000');
  await o.getByTestId('emergency-accept').click();
  await expect(o.getByText('Mekanik menuju lokasi').or(o.getByText('Diterima')).first()).toBeVisible();

  // The guest is notified that the workshop accepted and set a price.
  await g.goto('/notifications');
  await expect(g.getByTestId('notif-list')).toContainText('menerima panggilan darurat', { timeout: 30_000 });
  await expect(g.getByTestId('notif-list')).toContainText('estimasi Rp');

  // Guest pays via QRIS and uploads the proof.
  await g.goto(`/orders/${orderId}`);
  await g.getByTestId('pay-now').click();
  await expect(g).toHaveURL(new RegExp(`/orders/${orderId}/pay$`));
  await g.getByTestId('proof-input').setInputFiles(PROOF_IMAGE);
  await g.getByTestId('proof-submit').click();
  await expect(g).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(g.getByText(/Menunggu verifikasi/).first()).toBeVisible();

  // Workshop verifies the payment, then finishes the job.
  await o.goto('/owner/notifications');
  await expect(o.getByTestId('notif-list')).toContainText('Bukti bayar masuk dari Tamu E2E', { timeout: 30_000 });
  await o.goto('/owner/payments');
  await o.getByTestId('payment-verify').first().click();
  await expect(o.getByText('Pembayaran diverifikasi lunas')).toBeVisible();
  await o.goto(`/orders/${orderId}`);
  await o.getByRole('button', { name: 'Mulai Kerjakan' }).click();
  await o.getByRole('button', { name: 'Tandai Selesai' }).click();
  await expect(o.getByText('Pesanan ditandai selesai')).toBeVisible();

  await g.reload();
  await expect(g.getByText('Bantuan selesai').first()).toBeVisible();
  await guest.ctx.close();
});

test('cancelling a paid order: blocked while the proof is checked, then needs a refund confirmation', async ({ browser }) => {
  const guest = await newPage(browser, { geolocation: { latitude: location.lat, longitude: location.lng }, permissions: ['geolocation'] });
  const g = guest.page;
  await g.goto('/emergency');
  await g.getByTestId('sos-gps').click();
  await g.getByRole('button', { name: 'Ban bocor / pecah' }).click();
  await g.getByTestId('sos-guest-name').fill('Tamu Refund E2E');
  await g.getByTestId('sos-guest-wa').fill(`0815${digits()}`);
  await g.getByTestId('sos-submit').click();
  await expect(g).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  const id = g.url().split('/').pop()!;

  const o = ownerPage;
  await o.goto(`/orders/${id}`);
  await o.getByLabel('Estimasi biaya (Rp, opsional)').fill('80000');
  await o.getByTestId('emergency-accept').click();
  await expect(o.getByTestId('owner-cancel')).toBeVisible();

  // Guest pays; while the proof waits for verification nobody can cancel.
  await g.goto(`/orders/${id}/pay`);
  await g.getByTestId('proof-input').setInputFiles(PROOF_IMAGE);
  await g.getByTestId('proof-submit').click();
  await expect(g).toHaveURL(new RegExp(`/orders/${id}$`));
  await expect(g.getByText('Batalkan Permintaan Bantuan')).toHaveCount(0);
  await o.reload();
  await expect(o.getByTestId('cancel-blocked')).toBeVisible();
  await expect(o.getByTestId('owner-cancel')).toHaveCount(0);

  // Verified -> cancelling asks the owner to confirm the money was returned.
  await o.getByTestId('payment-verify').first().click();
  await expect(o.getByText('Pembayaran diverifikasi lunas')).toBeVisible();
  await o.getByTestId('owner-cancel').click();
  await expect(o.getByTestId('refund-cancel-confirm')).toBeDisabled();
  await o.getByTestId('refund-confirm').check();
  await o.getByTestId('refund-note').fill('Transfer balik ke DANA pelanggan');
  const res = o.waitForResponse((r) => r.url().includes(`/orders/${id}/status`));
  await o.getByTestId('refund-cancel-confirm').click();
  expect((await res).ok()).toBeTruthy();
  await expect(o.getByText('Dana dikembalikan').first()).toBeVisible();

  // The customer sees the refund and the workshop's note.
  await g.reload();
  await expect(g.getByTestId('refund-info')).toContainText(/Rp\s?80\.000/);
  await expect(g.getByTestId('refund-info')).toContainText('Transfer balik ke DANA pelanggan');
  await guest.ctx.close();
});

test('owner settings keep untouched fields: service duration and technician skills survive edits', async () => {
  const page = ownerPage;
  const serviceName = `Tune up E2E ${run}`;
  await page.goto('/owner/profile#layanan');
  await page.getByLabel('Nama layanan').fill(serviceName);
  await page.getByLabel('Harga (Rp)').fill('120000');
  await page.getByLabel('Durasi (menit)').fill('90');
  await page.getByRole('button', { name: 'Tambah layanan' }).click();
  const row = page.locator('tr').filter({ hasText: serviceName });
  await expect(row).toContainText('90 mnt');

  // Deactivate + reactivate: before the fix the API reset the duration to 60 on every partial update.
  await row.getByRole('button', { name: 'Nonaktifkan' }).click();
  await expect(row).toContainText('Nonaktif');
  await row.getByRole('button', { name: 'Aktifkan' }).click();
  await expect(row.getByText('Aktif', { exact: true })).toBeVisible();
  await expect(row).toContainText('90 mnt');

  // Edit modal (replaces the old price prompt): change the price only, duration must stay.
  await row.getByTestId('service-edit').click();
  await page.getByTestId('service-price').fill('135000');
  await page.getByTestId('service-save').click();
  await expect(row).toContainText('135.000');
  await expect(row).toContainText('90 mnt');

  // Technician archive -> restore keeps the skill tags.
  await page.goto('/owner/mechanics');
  await page.getByTestId('mechanic-name').fill('Teknisi Tag E2E');
  await page.getByLabel('Keahlian (pisahkan dengan koma)').fill('matic, injeksi');
  await page.getByTestId('mechanic-create').click();
  const tech = page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Tag E2E' });
  await expect(tech).toContainText('injeksi');
  await tech.getByTestId('mechanic-delete').click();
  await page.getByTestId('mechanic-delete-confirm').click();
  await page.getByRole('button', { name: /Lihat arsip teknisi/ }).click();
  await page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Tag E2E' }).getByRole('button', { name: 'Pulihkan' }).click();
  await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Tag E2E' }).getByText('Tersedia')).toBeVisible();
  await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Tag E2E' })).toContainText('matic');
  await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Teknisi Tag E2E' })).toContainText('injeksi');
});

test('uploads: videos are refused in the browser, oversized photos are shrunk before upload', async () => {
  const page = ownerPage;
  await page.goto('/owner/profile#qris');
  let uploads = 0;
  page.on('request', (r) => {
    if (r.url().includes('/workshops/qris')) uploads++;
  });

  // A video (even renamed to .jpg) never reaches the server.
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
  await page.getByTestId('qris-input').setInputFiles({ name: 'klip.mp4', mimeType: 'video/mp4', buffer: mp4 });
  await expect(page.getByText('Video tidak bisa diunggah')).toBeVisible();
  await page.getByTestId('qris-input').setInputFiles({ name: 'klip.jpg', mimeType: 'image/jpeg', buffer: mp4 });
  await expect(page.getByText('bukan foto yang valid')).toBeVisible();
  await expect(page.getByTestId('qris-submit')).toBeDisabled();
  expect(uploads).toBe(0);

  // A >2 MB photo (random noise PNG, like an uncompressed phone screenshot) is shrunk and accepted by the API.
  const big = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 1400;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i++) img.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const buffer = Buffer.from(big, 'base64');
  expect(buffer.length).toBeGreaterThan(2 * 1024 * 1024);
  await page.getByTestId('qris-input').setInputFiles({ name: 'qris-besar.png', mimeType: 'image/png', buffer });
  await expect(page.getByText(/Diperkecil dari/)).toBeVisible();
  const res = page.waitForResponse((r) => r.url().includes('/workshops/qris'));
  await page.getByTestId('qris-submit').click();
  expect((await res).ok()).toBeTruthy();
});

test('login sends a workshop owner back to the order link they opened', async ({ browser }) => {
  const { ctx, page } = await newPage(browser);
  await page.goto(`/orders/${orderId}`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByTestId('login-email').fill(owner.email);
  await page.getByTestId('login-password').fill(owner.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByText('Tamu E2E').first()).toBeVisible();
  await ctx.close();
});
