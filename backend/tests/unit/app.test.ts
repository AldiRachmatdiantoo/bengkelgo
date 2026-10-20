import request from 'supertest';
import { createApp } from '../../src/app';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { signAccessToken } from '../../src/common/utils/jwt';

// These tests exercise the HTTP layer only; every request is rejected before reaching the database.
const app = createApp();
const API = '/api/v1';

beforeEach(() => memoryStore.reset());

describe('HTTP security layer', () => {
  it('sets Helmet security headers', async () => {
    const res = await request(app).get(`${API}/nope`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get(`${API}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('validates payloads with Zod before controllers', async () => {
    const res = await request(app).post(`${API}/auth/guest`).send({ name: 'A', whatsapp: '123', latitude: 200, longitude: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'whatsapp', 'latitude']));
  });

  it('requires authentication on protected routes', async () => {
    const res = await request(app).post(`${API}/booking`).send({});
    expect(res.status).toBe(401);
  });

  it('rejects a forged / invalid bearer token', async () => {
    const res = await request(app).get(`${API}/auth/me`).set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('enforces role-based access (customer cannot reach admin)', async () => {
    const token = signAccessToken({ sub: '00000000-0000-0000-0000-000000000001', role: 'CUSTOMER' });
    const res = await request(app).get(`${API}/admin/reports/transactions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects non-UUID path params (injection attempts)', async () => {
    const token = signAccessToken({ sub: '00000000-0000-0000-0000-000000000001', role: 'CUSTOMER' });
    const res = await request(app).get(`${API}/orders/1' OR '1'='1`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rate limits the emergency API at 10 requests/minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // invalid body -> 400 without touching the DB, but still counted by the limiter
      statuses.push((await request(app).post(`${API}/emergency/scan`).send({})).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('rate limits auth endpoints at 15 requests/15 minutes', async () => {
    let last = 0;
    for (let i = 0; i < 16; i++) last = (await request(app).post(`${API}/auth/login`).send({})).status;
    expect(last).toBe(429);
  });

  it('rejects CORS preflight from unknown origins', async () => {
    const res = await request(app).options(`${API}/auth/login`).set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
