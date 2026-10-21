import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

/**
 * Forgot password, end to end against the local stack: the link is read from the email outbox in the local
 * database (example.test addresses are never really sent), exactly as the customer would get it.
 */
const API = '/api/v1';
const run = Date.now().toString(36);
const email = `lupa.${run}@example.test`;

const lastEmailText = (to: string) =>
  execSync(
    `docker compose exec -T db psql -U bengkel -d bengkel -Atc "SELECT body_text FROM email_outbox WHERE to_address = '${to}' ORDER BY id DESC LIMIT 1"`,
    { cwd: new URL('../../backend', import.meta.url), encoding: 'utf8' },
  );

test.skip(({ isMobile }) => isMobile, 'desktop flow');

test('forgot password: link from the login page, email, new password, sign in', async ({ page }) => {
  const reg = await page.request.post(`${API}/auth/register/customer`, { data: { name: 'Lupa Password', email, phone: '081234567890', password: 'Lama12345' } });
  expect(reg.ok(), await reg.text()).toBeTruthy();
  await page.context().clearCookies(); // signed out

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('forgot-link').click();
  await expect(page).toHaveURL(/\/lupa-password$/);
  await expect(page.getByTestId('forgot-email')).toHaveValue(email); // carried over from the login form
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByTestId('forgot-sent')).toContainText(email);

  let link = '';
  await expect(async () => {
    link = /https?:\/\/\S+\/reset-password\?token=\S+/.exec(lastEmailText(email))?.[0] ?? '';
    expect(link).not.toBe('');
  }).toPass({ timeout: 10_000 });

  await page.goto(new URL(link).pathname + new URL(link).search);
  await page.getByTestId('reset-password').fill('Baru12345');
  await page.getByTestId('reset-confirm').fill('Beda12345');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByText('Ulangi password yang sama')).toBeVisible(); // mismatch caught before sending
  await page.getByTestId('reset-confirm').fill('Baru12345');
  await page.getByTestId('reset-submit').click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Password baru sudah disimpan')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('Baru12345');
  await page.getByTestId('login-submit').click();
  await expect(page).not.toHaveURL(/\/login$/);

  // The link is single use.
  await page.context().clearCookies();
  await page.goto(new URL(link).pathname + new URL(link).search);
  await page.getByTestId('reset-password').fill('Lagi12345');
  await page.getByTestId('reset-confirm').fill('Lagi12345');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByText('Tautan ini sudah tidak berlaku')).toBeVisible();
});

test('an unknown email gets the same answer', async ({ page }) => {
  await page.goto('/lupa-password');
  await page.getByTestId('forgot-email').fill(`tidak.ada.${run}@example.test`);
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByTestId('forgot-sent')).toContainText('Kalau');
});
