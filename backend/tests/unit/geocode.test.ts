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

const NOMINATIM_REVERSE = {
  lat: '-6.3686',
  lon: '106.8319',
  name: '',
  address: { road: 'Jalan Margonda Raya', house_number: '12', village: 'Kemiri Muka', city_district: 'Beji', city: 'Depok', state: 'Jawa Barat', country_code: 'id' },
};

describe('geocodeService.reverse', () => {
  beforeEach(() => geocodeService.clearCache());
  afterEach(() => jest.restoreAllMocks());

  it('labels a point with its street and area, and caches nearby points (~10 m) together', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(json(200, NOMINATIM_REVERSE));
    const place = await geocodeService.reverse({ lat: -6.36861, lng: 106.83191 });
    expect(place).toEqual({ name: 'Jalan Margonda Raya 12', detail: 'Kemiri Muka, Beji, Depok, Jawa Barat', lat: -6.3686, lng: 106.8319, source: 'nominatim' });
    expect(calls(fetchMock)[0]).toContain('nominatim.openstreetmap.org/reverse');

    await geocodeService.reverse({ lat: -6.36863, lng: 106.83189 }); // same 4-decimal cell
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a short name when the OSM name already holds a whole address, without repeating it', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      json(200, {
        ...NOMINATIM_REVERSE,
        name: 'Gedung Taman Melati, Jalan Raya Margonda, Pondok Cina, Beji, Depok',
        address: { road: 'Jalan Raya Margonda', house_number: '503', suburb: 'Pondok Cina', city_district: 'Beji', city: 'Depok', state: 'Jawa Barat', country_code: 'id' },
      }),
    );
    await expect(geocodeService.reverse({ lat: -6.36, lng: 106.83 })).resolves.toMatchObject({
      name: 'Gedung Taman Melati',
      detail: 'Jalan Raya Margonda 503, Pondok Cina, Beji, Depok, Jawa Barat',
    });
  });

  it('returns null for points without an Indonesian address (sea, abroad)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json(200, { error: 'Unable to geocode' })).mockResolvedValueOnce(json(200, { features: [] }));
    await expect(geocodeService.reverse({ lat: -7.5, lng: 107.5 })).resolves.toBeNull();

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(200, { ...NOMINATIM_REVERSE, address: { ...NOMINATIM_REVERSE.address, country_code: 'sg' } }))
      .mockResolvedValueOnce(json(200, { features: [{ geometry: { coordinates: [103.8, 1.35] }, properties: { name: 'Orchard', countrycode: 'SG' } }] }));
    await expect(geocodeService.reverse({ lat: 1.35, lng: 103.8 })).resolves.toBeNull();
  });

  it('falls back to Photon, and answers 503 only when both services are down', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(502, {}))
      .mockResolvedValueOnce(json(200, { features: [{ geometry: { coordinates: [106.79, -6.595] }, properties: { street: 'Jalan Nyi Raja Permas', city: 'Bogor', state: 'Jawa Barat', countrycode: 'ID' } }] }));
    await expect(geocodeService.reverse({ lat: -6.595, lng: 106.79 })).resolves.toMatchObject({ name: 'Jalan Nyi Raja Permas', detail: 'Bogor, Jawa Barat', source: 'photon' });
    expect(calls(fetchMock)[1]).toContain('photon.komoot.io/reverse');

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(geocodeService.reverse({ lat: -6.2, lng: 106.8 })).rejects.toMatchObject({ statusCode: 503, code: 'GEOCODE_UNAVAILABLE' });
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

  it('GET /reverse validates the point and returns its address (or null)', async () => {
    expect((await request(app).get('/api/v1/geocode/reverse').query({ lat: 120, lng: 106.8 })).status).toBe(400);
    jest.spyOn(global, 'fetch').mockResolvedValue(json(200, NOMINATIM_REVERSE));
    const res = await request(app).get('/api/v1/geocode/reverse').query({ lat: -6.3686, lng: 106.8319 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { name: 'Jalan Margonda Raya 12' } });
  });
});
