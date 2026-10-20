import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { googleVerifier } from '../../src/features/auth/auth.service';
import { hashPassword } from '../../src/common/utils/crypto';
import { workshopRepository } from '../../src/features/workshop/workshop.repository';
import { API, createUser, describeDb, ORIGIN, resetDb } from './helpers';

const app = createApp();

describeDb('Auth (integration)', () => {
  beforeAll(resetDb);
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const creds = { name: 'Budi', email: 'budi@test.local', phone: '081234567890', password: 'Rahasia123' };

  it('registers a customer and logs in; refresh token stored only as hash', async () => {
    const reg = await request(app).post(`${API}/auth/register/customer`).send(creds);
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.role).toBe('CUSTOMER');
    expect(reg.headers['set-cookie'][0]).toMatch(/bengkel_rt=.*HttpOnly/);

    const { rows } = await pool.query('SELECT token_hash FROM refresh_tokens');
    expect(rows.every((r) => r.token_hash !== reg.body.data.refresh_token && r.token_hash.length === 64)).toBe(true);

    const dup = await request(app).post(`${API}/auth/register/customer`).send(creds);
    expect(dup.status).toBe(409);

    const login = await request(app).post(`${API}/auth/login`).send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    const me = await request(app).get(`${API}/auth/me`).set('Authorization', `Bearer ${login.body.data.access_token}`);
    expect(me.body.data.email).toBe(creds.email);
    expect(me.body.data.password_hash).toBeUndefined();
  });

  it('returns the same error for unknown email and wrong password (no user enumeration)', async () => {
    const a = await request(app).post(`${API}/auth/login`).send({ email: 'nobody@test.local', password: 'x' });
    const b = await request(app).post(`${API}/auth/login`).send({ email: creds.email, password: 'WrongPass1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toEqual(b.body.error);
  });

  it('rotates refresh tokens and revokes the whole family on reuse', async () => {
    const login = await request(app).post(`${API}/auth/login`).send({ email: creds.email, password: creds.password });
    const rt1 = login.body.data.refresh_token;

    const r2 = await request(app).post(`${API}/auth/refresh`).send({ refresh_token: rt1 });
    expect(r2.status).toBe(200);
    const rt2 = r2.body.data.refresh_token;
    expect(rt2).not.toBe(rt1);

    // Attacker replays the old token -> reuse detected
    const replay = await request(app).post(`${API}/auth/refresh`).send({ refresh_token: rt1 });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');

    // ...and the legitimate latest token is now revoked too
    const after = await request(app).post(`${API}/auth/refresh`).send({ refresh_token: rt2 });
    expect(after.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const login = await request(app).post(`${API}/auth/login`).send({ email: creds.email, password: creds.password });
    await request(app).post(`${API}/auth/logout`).send({ refresh_token: login.body.data.refresh_token }).expect(200);
    const r = await request(app).post(`${API}/auth/refresh`).send({ refresh_token: login.body.data.refresh_token });
    expect(r.status).toBe(401);
  });

  it('creates a guest session with name, WhatsApp and GPS', async () => {
    const res = await request(app)
      .post(`${API}/auth/guest`)
      .send({ name: 'Tamu', whatsapp: '081298765432', latitude: ORIGIN.lat, longitude: ORIGIN.lng });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('GUEST');
    const { rows } = await pool.query('SELECT ST_Y(last_location::geometry) AS lat FROM users WHERE id = $1', [res.body.data.user.id]);
    expect(rows[0].lat).toBeCloseTo(ORIGIN.lat, 5);
  });

  it('Google OAuth auto-creates a CUSTOMER and links on next login', async () => {
    const spy = jest
      .spyOn(googleVerifier, 'exchange')
      .mockResolvedValue({ sub: 'google-123', email: 'gina@gmail.com', name: 'Gina', emailVerified: true });
    const body = { code: 'auth-code-abcdefghij', code_verifier: 'v'.repeat(43) };

    const first = await request(app).post(`${API}/auth/google`).send(body);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ is_new_user: true, user: { role: 'CUSTOMER', email: 'gina@gmail.com' } });

    const second = await request(app).post(`${API}/auth/google`).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);

    spy.mockResolvedValue({ sub: 'google-999', email: 'x@gmail.com', name: 'X', emailVerified: false });
    expect((await request(app).post(`${API}/auth/google`).send(body)).status).toBe(401);
    spy.mockRestore();
  });

  it('workshop registration is atomic and starts PENDING until admin approval', async () => {
    const payload = {
      owner: { name: 'Pak Owner', email: 'owner@test.local', phone: '081234567891', password: 'Bengkel123' },
      workshop: { name: 'Bengkel Jaya', address: 'Jl. Merdeka 1', phone: '081234567891', latitude: ORIGIN.lat, longitude: ORIGIN.lng },
    };
    const res = await request(app).post(`${API}/auth/register/workshop`).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.workshop.status).toBe('PENDING');

    // Not publicly visible yet
    expect((await request(app).get(`${API}/workshops/${res.body.data.workshop.id}`)).status).toBe(404);

    await pool.query(`INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@test.local', $1, 'ADMIN')`, [
      await hashPassword('AdminPass123'),
    ]);
    const admin = await request(app).post(`${API}/auth/login`).send({ email: 'admin@test.local', password: 'AdminPass123' });
    const approve = await request(app)
      .patch(`${API}/admin/workshops/${res.body.data.workshop.id}/approval`)
      .set('Authorization', `Bearer ${admin.body.data.access_token}`)
      .send({ action: 'APPROVE' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('APPROVED');
    expect((await request(app).get(`${API}/workshops/${res.body.data.workshop.id}`)).status).toBe(200);
  });

  it('owner registration rolls back the user when the workshop insert fails', async () => {
    const spy = jest.spyOn(workshopRepository, 'create').mockRejectedValueOnce(new Error('simulated failure'));
    const res = await request(app)
      .post(`${API}/auth/register/workshop`)
      .send({
        owner: { name: 'Broken', email: 'broken@test.local', phone: '081234567892', password: 'Bengkel123' },
        workshop: { name: 'Bengkel X', address: 'Jl. X 1', phone: '081234567892', latitude: 0, longitude: 0 },
      });
    spy.mockRestore();
    expect(res.status).toBe(500);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE email = 'broken@test.local'`);
    expect(rows[0].n).toBe(0); // no orphaned owner account
  });

  it('customer token cannot access another role endpoint', async () => {
    const c = await createUser('CUSTOMER');
    expect((await request(app).put(`${API}/workshops/profile`).set(c.auth).send({ name: 'Hack' })).status).toBe(403);
  });
});
