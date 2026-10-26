import { execSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * "Akun saya" against the local stack: details, photo, password, change of email (the code is read from the
 * email outbox in the local database), signed-in devices and deleting the account; the owner's page too.
 */
const API = '/api/v1';
const PHOTO = path.resolve(import.meta.dirname, '../../backend/docs/postman/sample-image.png');
const run = Date.now().toString(36);
const digits = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));

const lastEmailText = (to: string) =>
  execSync(
    `docker compose exec -T db psql -U bengkel -d bengkel -Atc "SELECT body_text FROM email_outbox WHERE to_address = '${to}' ORDER BY id DESC LIMIT 1"`,
    { cwd: new URL('../../backend', import.meta.url), encoding: 'utf8' },
  );

test.skip(({ isMobile }) => isMobile, 'desktop flow');

test('customer: details, photo, password, new email, devices, then deleting the account', async ({ page, browser }) => {
  const email = `akun.${run}@example.test`;
  const newEmail = `akun.baru.${run}@example.test`;
  const reg = await page.request.post(`${API}/auth/register/customer`, { data: { name: 'Akun Uji', email, phone: `0812${digits()}`, password: 'Lama12345' } });
  expect(reg.ok(), await reg.text()).toBeTruthy();
  // A second device signed in to the same account.
  const other = await browser.newContext();
  expect((await other.request.post(`${API}/auth/login`, { data: { email, password: 'Lama12345' } })).ok()).toBeTruthy();

  await page.goto('/');
  await page.goto('/akun');
  await expect(page.getByRole('heading', { name: 'Akun Saya' })).toBeVisible();

  // Details
  await page.getByTestId('account-name-input').fill('Akun Uji Baru');
  await page.getByTestId('account-details-save').click();
  await expect(page.getByText('Data diri disimpan')).toBeVisible();
  await expect(page.getByTestId('account-name')).toHaveText('Akun Uji Baru');

  // Photo: shown on the page and in the header
  await page.getByTestId('account-photo-input').setInputFiles(PHOTO);
  await expect(page.getByTestId('user-avatar-photo')).toBeVisible();
  await expect(page.getByTestId('header-avatar-photo')).toBeVisible();

  // Devices: this one plus the other
  await expect(page.getByTestId('account-session')).toHaveCount(2);
  await expect(page.getByTestId('account-sessions')).toContainText('Perangkat ini');

  // Password: the other device is signed out, this one stays
  await page.getByTestId('account-pw-current').fill('Lama12345');
  await page.getByTestId('account-pw-new').fill('Baru12345');
  await page.getByTestId('account-pw-confirm').fill('Baru12345');
  await page.getByTestId('account-pw-save').click();
  await expect(page.getByText('1 perangkat lain dikeluarkan.')).toBeVisible();
  await expect(page.getByTestId('account-session')).toHaveCount(1);
  expect((await other.request.post(`${API}/auth/refresh`, { data: {} })).status()).toBe(401);
  await other.close();

  // New email, confirmed with the code sent to it
  await page.getByTestId('account-email-change').click();
  await page.getByTestId('account-new-email').fill(newEmail);
  await page.getByTestId('account-email-password').fill('Baru12345');
  await page.getByTestId('account-email-send').click();
  let code = '';
  await expect(async () => {
    code = /Kode verifikasi\s*: (\d{6})/.exec(lastEmailText(newEmail))?.[1] ?? '';
    expect(code).not.toBe('');
  }).toPass({ timeout: 10_000 });
  await page.getByTestId('account-email-code').fill(code);
  await page.getByTestId('account-email-confirm').click();
  await expect(page.getByTestId('account-email')).toHaveText(newEmail);
  await expect(page.getByText('Email terverifikasi')).toBeVisible();

  // Survives a reload (session cookie), then delete the account
  await page.reload();
  await expect(page.getByTestId('account-name')).toHaveText('Akun Uji Baru');
  await page.getByTestId('account-delete').click();
  await page.getByTestId('account-delete-secret').fill('Baru12345');
  await page.getByTestId('account-delete-confirm').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Akun Anda sudah dihapus')).toBeVisible();
  expect((await page.request.post(`${API}/auth/login`, { data: { email: newEmail, password: 'Baru12345' } })).status()).toBe(401);
});

test('workshop owner: "Akun Saya" in the portal, without deleting the account', async ({ page }) => {
  const owner = { name: 'Pemilik Akun', email: `owner.akun.${run}@example.test`, phone: `0813${digits()}`, password: 'Owner12345' };
  const reg = await page.request.post(`${API}/auth/register/workshop`, {
    data: { owner, workshop: { name: `Bengkel Akun ${run}`, address: 'Jl. Akun No. 1', phone: `0813${digits()}`, latitude: -6.2, longitude: 106.8, vehicle_types: ['MOTOR'] } },
  });
  expect(reg.ok(), await reg.text()).toBeTruthy();

  await page.goto('/owner');
  await page.getByRole('link', { name: 'Akun Saya' }).first().click();
  await expect(page).toHaveURL(/\/owner\/akun$/);
  await expect(page.getByTestId('account-email')).toHaveText(owner.email);
  await expect(page.getByText('Nomor bengkel diatur di Pengaturan Bengkel')).toBeVisible();
  await expect(page.getByTestId('account-delete')).toHaveCount(0);
});
