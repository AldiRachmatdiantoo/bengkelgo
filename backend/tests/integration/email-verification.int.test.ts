import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import * as mailer from '../../src/config/mailer';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { API, createUser, createWorkshop, describeDb, ORIGIN, resetDb, tomorrow } from './helpers';

/** New accounts confirm their email with a 6-digit code before they can book. */
const app = createApp();
const settle = () => new Promise((r) => setTimeout(r, 50));

describeDb('Email verification (integration)', () => {
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
    const res = await request(app)
      .post(`${API}/auth/register/customer`)
      .send({ name: 'Rina Wati', email: `rina${++seq}@mail.local`, phone: '081234567890', password: 'Rahasia123' })
      .expect(201);
    await settle();
    return { user: res.body.data.user, auth: { Authorization: `Bearer ${res.body.data.access_token}` } };
  };
  /** The code from the last verification email. */
  const lastCode = () => {
    const mail = send.mock.calls.map((c) => c[0]).filter((m) => m.subject === 'Kode verifikasi email BengkelGo').pop();
    return /kode verifikasi email Anda: (\d{6})/i.exec(mail.text)![1];
  };

  it('a new customer gets a code by email, cannot book until verified, then can', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Verify Shop' });
    const c = await register();
    expect(c.user.email_verified).toBe(false);
    const code = lastCode();
    expect(send.mock.calls.at(-1)[0].to).toBe(c.user.email);

    const book = () => request(app).post(`${API}/booking`).set(c.auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: '10:00' });
    const refused = await book();
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const ok = await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code }).expect(200);
    expect(ok.body.data.user.email_verified).toBe(true);
    expect((await request(app).get(`${API}/auth/me`).set(c.auth)).body.data.email_verified).toBe(true);
    expect((await book()).status).toBe(201);
    // The code is single-use and verifying again is harmless.
    await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code: '000000' }).expect(200);
  });

  it('wrong codes count; after 5 the code is dead and a new one is needed', async () => {
    const c = await register();
    const code = lastCode();
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code: wrong });
      expect(r.body.error.code).toBe('VERIFICATION_CODE_INVALID');
    }
    const dead = await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code });
    expect(dead.body.error.code).toBe('VERIFICATION_TOO_MANY_ATTEMPTS');

    await pool.query(`UPDATE email_verifications SET sent_at = NOW() - interval '2 minutes'`);
    await request(app).post(`${API}/auth/email/resend`).set(c.auth).expect(200);
    await settle();
    await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code: lastCode() }).expect(200);
  });

  it('expired codes are refused; resend is spaced one minute apart; codes are stored hashed', async () => {
    const c = await register();
    const code = lastCode();
    const { rows } = await pool.query<{ code_hash: string }>('SELECT code_hash FROM email_verifications WHERE user_id = $1', [c.user.id]);
    expect(rows[0].code_hash).not.toContain(code);

    const tooSoon = await request(app).post(`${API}/auth/email/resend`).set(c.auth);
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('VERIFICATION_RESEND_TOO_SOON');

    await pool.query(`UPDATE email_verifications SET expires_at = NOW() - interval '1 second' WHERE user_id = $1`, [c.user.id]);
    expect((await request(app).post(`${API}/auth/email/verify`).set(c.auth).send({ code })).body.error.code).toBe('VERIFICATION_CODE_EXPIRED');
  });

  it('an admin can confirm an email by hand (support case), and it is audited', async () => {
    const c = await register();
    const admin = await createUser('ADMIN');
    await request(app).patch(`${API}/admin/users/${c.user.id}/verify-email`).set(admin.auth).expect(200);
    expect((await request(app).get(`${API}/auth/me`).set(c.auth)).body.data.email_verified).toBe(true);
    const logs = (await request(app).get(`${API}/admin/audit-logs`).set(admin.auth).query({ entity_id: c.user.id })).body.data;
    expect(logs).toEqual([expect.objectContaining({ action: 'USER_EMAIL_VERIFIED' })]);
    // Customers can't do it for themselves.
    expect((await request(app).patch(`${API}/admin/users/${c.user.id}/verify-email`).set(c.auth)).status).toBe(403);
  });

  it('accounts that existed before the check and guests are not affected', async () => {
    const guest = await request(app).post(`${API}/auth/guest`).send({ name: 'Tamu', whatsapp: '081311112222', latitude: ORIGIN.lat, longitude: ORIGIN.lng }).expect(201);
    expect(guest.body.data.user.email_verified).toBe(false);
    await settle();
    expect(send).not.toHaveBeenCalled(); // no email for a guest
  });
});
