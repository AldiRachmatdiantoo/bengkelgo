/**
 * Place search over free OpenStreetMap services: Nominatim first, Photon as the fallback, cached answers.
 * Network calls are mocked.
 */
import { geocodeService } from '../../src/features/geocode/geocode.service';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const calls = (m: jest.SpyInstance) => (m.mock.calls as [URL | string, RequestInit][]).map(([u]) => String(u));

const NOMINATIM_ROW = {
  lat: '-6.5936008',
  lon: '106.7906425',
  name: 'Stasiun Bogor',
  display_name: 'Stasiun Bogor, Bogor Tengah, Bogor, Jawa Barat, Indonesia',
};
const PHOTON_BODY = {
  features: [
    { geometry: { coordinates: [106.8318, -6.3685] }, properties: { name: 'Jalan Margonda Raya', city: 'Depok', state: 'Jawa Barat', countrycode: 'ID' } },
    { geometry: { coordinates: [103.8, 1.35] }, properties: { name: 'Margonda (SG)', countrycode: 'SG' } }, // outside Indonesia: dropped
  ],
};

describe('geocodeService.search', () => {
  beforeEach(() => geocodeService.clearCache());
  afterEach(() => jest.restoreAllMocks());

  it('answers from Nominatim (Indonesia only, identifying User-Agent) and caches the result', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(json(200, [NOMINATIM_ROW]));
    const first = await geocodeService.search({ q: 'Stasiun Bogor', limit: 5 });
    expect(first).toEqual([{ name: 'Stasiun Bogor', detail: 'Bogor Tengah, Bogor, Jawa Barat', lat: -6.5936008, lng: 106.7906425, source: 'nominatim' }]);

    const [url] = calls(fetchMock);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('countrycodes=id');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'User-Agent': expect.stringMatching(/^BengkelGo\//) });

    await geocodeService.search({ q: 'stasiun bogor', limit: 5 }); // same query, different case: cache hit
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Photon when Nominatim fails, keeping only places in Indonesia', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(json(503, {})).mockResolvedValueOnce(json(200, PHOTON_BODY));
    const places = await geocodeService.search({ q: 'Margonda', limit: 5 });
    expect(calls(fetchMock)[1]).toContain('photon.komoot.io/api');
    expect(places).toEqual([{ name: 'Jalan Margonda Raya', detail: 'Depok, Jawa Barat', lat: -6.3685, lng: 106.8318, source: 'photon' }]);
  });

  it('returns an empty list when nothing matches, and 503 only when both services are down', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json(200, [])).mockResolvedValueOnce(json(200, { features: [] }));
    await expect(geocodeService.search({ q: 'zzzz tidak ada', limit: 5 })).resolves.toEqual([]);

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(geocodeService.search({ q: 'Depok', limit: 5 })).rejects.toMatchObject({ statusCode: 503, code: 'GEOCODE_UNAVAILABLE' });
  });
});

describe('GET /api/v1/geocode/search', () => {
  // Loaded lazily so the service tests above don't build the whole app.
  const request = require('supertest') as typeof import('supertest');
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  const { memoryStore } = require('../../src/common/middlewares/rateLimiter') as typeof import('../../src/common/middlewares/rateLimiter');
  const app = createApp();

  beforeEach(() => {
    memoryStore.reset();
    geocodeService.clearCache();
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects queries shorter than 3 characters', async () => {
    const res = await request(app).get('/api/v1/geocode/search').query({ q: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('is public and returns places in the standard envelope', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(json(200, [NOMINATIM_ROW]));
    const res = await request(app).get('/api/v1/geocode/search').query({ q: 'Stasiun Bogor', limit: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [{ name: 'Stasiun Bogor', lat: -6.5936008, lng: 106.7906425 }] });
  });
});
