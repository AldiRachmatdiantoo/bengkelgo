import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E (PBI-407 / PRD 8.2). Needs the backend running (docker compose up -d, API on :8080).
// Admin credentials come from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, or fall back to SEED_ADMIN_* in ../backend/.env.
function adminFromBackendEnv() {
  try {
    const env = fs.readFileSync(path.resolve(import.meta.dirname, '../backend/.env'), 'utf8');
    const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
    return { email: get('SEED_ADMIN_EMAIL'), password: get('SEED_ADMIN_PASSWORD') };
  } catch {
    return {};
  }
}
const admin = adminFromBackendEnv();
process.env.E2E_ADMIN_EMAIL ??= admin.email ?? 'admin@bengkelapp.com';
process.env.E2E_ADMIN_PASSWORD ??= admin.password ?? '';

const PORT = Number(process.env.E2E_PORT ?? 5199);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /a11y|smoke|cross-browser|visual/ },
    // Cross-browser (PRD 8.2): `npm run test:e2e:cross`. Needs `npx playwright install firefox webkit` once.
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } }, testMatch: /cross-browser/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] }, testMatch: /cross-browser|smoke/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } }, testMatch: /cross-browser/ },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
