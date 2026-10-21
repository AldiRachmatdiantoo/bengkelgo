import { expect, test, type Page } from '@playwright/test';

// Location search answers are faked so the test never depends on the public OpenStreetMap services.
const PLACES = [
  { name: 'Stasiun Bogor', detail: 'Jalan Nyi Raja Permas, Bogor Tengah, Bogor, Jawa Barat', lat: -6.5954, lng: 106.7905, source: 'nominatim' },
  { name: 'Stasiun Bogor Paledang', detail: 'Paledang, Bogor Tengah, Bogor', lat: -6.6002, lng: 106.7929, source: 'nominatim' },
];

async function fakeGeocode(page: Page, reply: { status: number; body: unknown }) {
  const queries: string[] = [];
  await page.route('**/api/v1/geocode/search**', (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  return queries;
}

test('location search: searches on Enter only, picking a place moves the search point', async ({ page }) => {
  const queries = await fakeGeocode(page, { status: 200, body: { success: true, data: PLACES } });
  await page.goto('/workshops?tab=cari');

  const input = page.getByTestId('place-search-input');
  await input.fill('Stasiun Bogor');
  expect(queries).toHaveLength(0); // no type-ahead: the provider forbids it
  await input.press('Enter');

  const results = page.getByTestId('place-search-results');
  await expect(results.getByRole('option')).toHaveCount(2);
  expect(queries).toEqual(['Stasiun Bogor']);

  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(results).toBeHidden();
  await expect(page.getByTestId('search-around')).toContainText('Stasiun Bogor Paledang');

  await page.getByTestId('search-around').getByRole('button', { name: 'Hapus lokasi' }).click();
  await expect(page.getByTestId('search-around')).toBeHidden();
});

test('workshop sign-up: the pin shows its approximate address, which can fill the address field', async ({ page }) => {
  await fakeGeocode(page, { status: 200, body: { success: true, data: PLACES } });
  const reverseCalls: string[] = [];
  await page.route('**/api/v1/geocode/reverse**', (route) => {
    reverseCalls.push(route.request().url());
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { name: 'Stasiun Bogor', detail: 'Jalan Nyi Raja Permas, Bogor Tengah, Bogor', lat: -6.5954, lng: 106.7905, source: 'nominatim' } }),
    });
  });
  await page.goto('/register/workshop');

  const input = page.getByTestId('place-search-input');
  await input.fill('Stasiun Bogor');
  await input.press('Enter');
  await page.getByTestId('place-search-results').getByRole('option').first().click();

  const hint = page.getByTestId('address-hint');
  await expect(hint).toContainText('Perkiraan alamat: Stasiun Bogor, Jalan Nyi Raja Permas');
  await hint.getByTestId('address-hint-use').click();
  await expect(page.locator('#ws-address')).toHaveValue('Stasiun Bogor, Jalan Nyi Raja Permas, Bogor Tengah, Bogor');
  expect(reverseCalls).toHaveLength(1);
});

test('location search on the SOS form: Enter never submits the form, an outage says so', async ({ page }) => {
  await fakeGeocode(page, {
    status: 503,
    body: { success: false, error: { code: 'GEOCODE_UNAVAILABLE', message: 'Place search is temporarily unavailable' } },
  });
  let sosRequests = 0;
  await page.route('**/api/v1/emergency/request', (route) => {
    sosRequests++;
    return route.abort();
  });
  await page.goto('/emergency');

  const input = page.getByTestId('place-search-input');
  await input.fill('Stasiun Bogor');
  await input.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Pencarian lokasi sedang tidak tersedia' })).toBeVisible();
  expect(sosRequests).toBe(0);
});
