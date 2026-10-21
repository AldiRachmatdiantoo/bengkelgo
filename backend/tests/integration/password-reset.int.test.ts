import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import * as mailer from '../../src/config/mailer';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { API, describeDb, resetDb } from './helpers';

/** Forgot password: a single-use link by email, the same answer for unknown emails, sessions ended afterwards. */
const app = createApp();
const settle = () => new Promise((r) => setTimeout(r, 50));

describeDb('Password reset (integration)', () => {
  let send: jest.SpyInstance;
  let seq = 0;
  beforeAll(() => resetDb());
  beforeEach(() => {
    memoryStore.reset();
    send = jest.spyOn(mailer, 'sendMail').mockResolvedValue();
  });
  afterEach(() => send.mockRestore());
  afterAll(() => pool.end());

  const register = async () => {
    const creds = { name: 'Rudi Lupa', email: `rudi${++seq}@mail.local`, phone: '081234567890', password: 'Lama12345' };
    const res = await request(app).post(`${API}/auth/register/customer`).send(creds).expect(201);
    await settle();
    send.mockClear();
    return { ...creds, refresh: res.body.data.refresh_token as string };
  };
  const forgot = (email: string) => request(app).post(`${API}/auth/password/forgot`).send({ email });
  /** The token from the last reset email's link. */
  const lastToken = () => {
    const mail = send.mock.calls.map((c) => c[0]).filter((m) => m.subject === 'Buat password baru BengkelGo').pop();
    return decodeURIComponent(/reset-password\?token=([^\s"&]+)/.exec(mail.text)![1]);
  };
  const login = (email: string, password: string) => request(app).post(`${API}/auth/login`).send({ email, password });

  it('emails a link; the new password works, the old one and every old session stop working', async () => {
    const u = await register();
    expect((await forgot(u.email).expect(200)).body.data).toEqual({ sent: true });
    await settle();
    const token = lastToken();
    expect(send.mock.calls.at(-1)[0].to).toBe(u.email);

    await request(app).post(`${API}/auth/password/reset`).send({ token, password: 'Baru12345' }).expect(200);
    await settle();
    expect(send.mock.calls.some((c) => c[0].subject === 'Password BengkelGo Anda sudah diganti')).toBe(true);
    expect((await login(u.email, 'Baru12345')).status).toBe(200);
    expect((await login(u.email, 'Lama12345')).status).toBe(401);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: u.refresh })).status).toBe(401);

    // Single use.
    const again = await request(app).post(`${API}/auth/password/reset`).send({ token, password: 'Lagi12345' });
    expect(again.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('answers the same for an unknown email and sends nothing', async () => {
    const res = await forgot('tidak.terdaftar@mail.local').expect(200);
    expect(res.body.data).toEqual({ sent: true });
    await settle();
    expect(send).not.toHaveBeenCalled();
  });

  it('expired links are refused; tokens are stored hashed; a new request within a minute is skipped', async () => {
    const u = await register();
    await forgot(u.email).expect(200);
    await settle();
    const token = lastToken();
    const { rows } = await pool.query<{ token_hash: string }>('SELECT token_hash FROM password_resets');
    expect(rows.some((r) => r.token_hash.includes(token))).toBe(false);

    await forgot(u.email).expect(200);
    await settle();
    expect(send.mock.calls.filter((c) => c[0].subject === 'Buat password baru BengkelGo')).toHaveLength(1);

    await pool.query(`UPDATE password_resets SET expires_at = NOW() - interval '1 second'`);
    expect((await request(app).post(`${API}/auth/password/reset`).send({ token, password: 'Baru12345' })).body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('weak passwords are refused, and requests per email are capped', async () => {
    const u = await register();
    await forgot(u.email);
    await settle();
    expect((await request(app).post(`${API}/auth/password/reset`).send({ token: lastToken(), password: 'lemah' })).status).toBe(400);

    memoryStore.reset();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await forgot('banjir@mail.local')).status);
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it('a Google-only account (no password yet) can set one, which also confirms the email', async () => {
    await pool.query(`INSERT INTO users (name, email, role, google_sub) VALUES ('Gina Google', 'gina@mail.local', 'CUSTOMER', 'g-123')`);
    await forgot('gina@mail.local').expect(200);
    await settle();
    await request(app).post(`${API}/auth/password/reset`).send({ token: lastToken(), password: 'Pertama123' }).expect(200);
    expect((await login('gina@mail.local', 'Pertama123')).status).toBe(200);
    const { rows } = await pool.query(`SELECT email_verified_at FROM users WHERE email = 'gina@mail.local'`);
    expect(rows[0].email_verified_at).not.toBeNull();
  });
});
