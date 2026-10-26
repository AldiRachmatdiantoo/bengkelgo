import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import * as mailer from '../../src/config/mailer';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { API, createUser, createWorkshop, describeDb, ORIGIN, resetDb, tomorrow } from './helpers';

/** "Akun saya": own details, photo, password, change of email, signed-in devices and deleting the account. */
const app = createApp();
const settle = () => new Promise((r) => setTimeout(r, 50));
const cookie = (refresh: string) => ({ Cookie: `bengkel_rt=${refresh}` });

describeDb('Account / profile (integration)', () => {
  let send: jest.SpyInstance;
  let seq = 0;
  beforeAll(() => resetDb());
  beforeEach(() => {
    memoryStore.reset();
    send = jest.spyOn(mailer, 'sendMail').mockResolvedValue();
  });
  afterEach(() => send.mockRestore());
  afterAll(() => pool.end());

  const register = async (password = 'Lama12345') => {
    const creds = { name: 'Sari Profil', email: `sari${++seq}@mail.local`, phone: '081234567890', password };
    const res = await request(app).post(`${API}/auth/register/customer`).send(creds).expect(201);
    await settle();
    send.mockClear();
    return { ...creds, id: res.body.data.user.id as string, refresh: res.body.data.refresh_token as string, auth: { Authorization: `Bearer ${res.body.data.access_token}` } };
  };
  const login = (email: string, password: string) => request(app).post(`${API}/auth/login`).send({ email, password });
  const mails = (subject: string) => send.mock.calls.map((c) => c[0]).filter((m) => m.subject === subject);
  const lastChangeCode = () => /Kode verifikasi\s*: (\d{6})/.exec(mails('Kode untuk mengganti email BengkelGo').pop().text)![1];

  it('GET /auth/me describes the account; name and WhatsApp number can be changed', async () => {
    const u = await register();
    const me = (await request(app).get(`${API}/auth/me`).set(u.auth).expect(200)).body.data;
    expect(me).toMatchObject({ name: 'Sari Profil', has_password: true, google_linked: false, photo_url: null, email_verified: false });
    expect(me.created_at).toBeTruthy();

    const upd = await request(app).patch(`${API}/auth/me`).set(u.auth).send({ name: '  Sari Baru ', phone: '085712345678' }).expect(200);
    expect(upd.body.data.user).toMatchObject({ name: 'Sari Baru', phone: '085712345678' });
    expect((await request(app).patch(`${API}/auth/me`).set(u.auth).send({ phone: '12345' })).body.error.code).toBe('VALIDATION_ERROR');
    expect((await request(app).patch(`${API}/auth/me`).set(u.auth).send({})).status).toBe(400);

    // A guest (SOS without an account) may fix the name and number, nothing else.
    const g = await createUser('GUEST');
    await request(app).patch(`${API}/auth/me`).set(g.auth).send({ name: 'Tamu Baru' }).expect(200);
    expect((await request(app).put(`${API}/auth/me/password`).set(g.auth).send({ new_password: 'Rahasia123' })).status).toBe(403);
  });

  it('changing the password needs the current one; this device stays signed in, the others are signed out', async () => {
    const u = await register();
    const other = (await login(u.email, 'Lama12345').expect(200)).body.data.refresh_token as string;

    const wrong = await request(app).put(`${API}/auth/me/password`).set(u.auth).set(cookie(u.refresh)).send({ current_password: 'Salah12345', new_password: 'Baru12345' });
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');
    expect((await request(app).put(`${API}/auth/me/password`).set(u.auth).send({ new_password: 'Baru12345' })).body.error.code).toBe('PASSWORD_REQUIRED');

    const ok = await request(app).put(`${API}/auth/me/password`).set(u.auth).set(cookie(u.refresh)).send({ current_password: 'Lama12345', new_password: 'Baru12345' }).expect(200);
    expect(ok.body.data.signed_out_devices).toBe(1);
    await settle();
    expect(mails('Password BengkelGo Anda sudah diganti')).toHaveLength(1);
    expect((await login(u.email, 'Baru12345')).status).toBe(200);
    expect((await login(u.email, 'Lama12345')).status).toBe(401);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: other })).status).toBe(401);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: u.refresh })).status).toBe(200);
  });

  it('an account made with Google can set its first password without a current one', async () => {
    const g = await createUser('CUSTOMER'); // no password, like a Google sign-up
    expect((await request(app).get(`${API}/auth/me`).set(g.auth)).body.data.has_password).toBe(false);
    const res = await request(app).put(`${API}/auth/me/password`).set(g.auth).send({ new_password: 'Pertama123' }).expect(200);
    expect(res.body.data.user.has_password).toBe(true);
    await settle();
    expect(mails('Password BengkelGo Anda sudah dibuat')).toHaveLength(1);
  });

  it('a new email is confirmed with a code sent to it; the old address is told; login uses the new one', async () => {
    const u = await register();
    const taken = await register();
    const ask = (body: object) => request(app).post(`${API}/auth/me/email-change`).set(u.auth).send(body);

    expect((await ask({ email: u.email, password: 'Lama12345' })).body.error.code).toBe('SAME_EMAIL');
    expect((await ask({ email: taken.email, password: 'Lama12345' })).body.error.code).toBe('EMAIL_TAKEN');
    expect((await ask({ email: 'baru@mail.local', password: 'Salah12345' })).body.error.code).toBe('WRONG_PASSWORD');
    expect((await ask({ email: 'baru@mail.local' })).body.error.code).toBe('PASSWORD_REQUIRED');

    const newEmail = `sari.baru${seq}@mail.local`;
    expect((await ask({ email: newEmail.toUpperCase(), password: 'Lama12345' }).expect(200)).body.data).toEqual({ new_email: newEmail, expires_in_minutes: 15 });
    await settle();
    expect(mails('Kode untuk mengganti email BengkelGo').pop().to).toBe(newEmail);
    expect((await ask({ email: newEmail, password: 'Lama12345' })).body.error.code).toBe('VERIFICATION_RESEND_TOO_SOON');
    expect((await request(app).get(`${API}/auth/me/email-change`).set(u.auth)).body.data.new_email).toBe(newEmail);

    const code = lastChangeCode();
    const bad = await request(app).post(`${API}/auth/me/email-change/confirm`).set(u.auth).send({ code: code === '000000' ? '111111' : '000000' });
    expect(bad.body.error.code).toBe('VERIFICATION_CODE_INVALID');
    expect((await pool.query('SELECT attempts FROM email_changes WHERE user_id = $1', [u.id])).rows[0].attempts).toBe(1);

    const done = await request(app).post(`${API}/auth/me/email-change/confirm`).set(u.auth).send({ code }).expect(200);
    expect(done.body.data.user).toMatchObject({ email: newEmail, email_verified: true }); // also confirms an unverified account
    await settle();
    expect(mails('Email akun BengkelGo Anda sudah diganti').pop().to).toBe(u.email);
    expect((await login(newEmail, 'Lama12345')).status).toBe(200);
    expect((await login(u.email, 'Lama12345')).status).toBe(401);
    expect((await request(app).get(`${API}/auth/me/email-change`).set(u.auth)).body.data).toBeNull();
    const log = await pool.query(`SELECT details FROM audit_logs WHERE action = 'USER_EMAIL_CHANGED' AND entity_id = $1`, [u.id]);
    expect(log.rows[0].details).toMatchObject({ from: u.email, to: newEmail });
  });

  it('a profile photo is stored as a small WebP that only its owner can open', async () => {
    const u = await register();
    const big = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#4361EE' } }).png().toBuffer();
    const up = await request(app).put(`${API}/auth/me/photo`).set(u.auth).attach('photo', big, { filename: 'saya.png', contentType: 'image/png' }).expect(200);
    const url = up.body.data.user.photo_url as string;
    expect(url).toMatch(/^\/auth\/me\/photo\?v=/);

    const img = await request(app).get(`${API}${url}`).set(u.auth).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(img.headers['cache-control']).toContain('private');
    const meta = await sharp(img.body as Buffer).metadata();
    expect([meta.format, Math.max(meta.width!, meta.height!)]).toEqual(['webp', 256]);
    expect((await request(app).get(`${API}${url}`)).status).toBe(401);

    const removed = await request(app).delete(`${API}/auth/me/photo`).set(u.auth).expect(200);
    expect(removed.body.data.user.photo_url).toBeNull();
    expect((await request(app).get(`${API}/auth/me/photo`).set(u.auth)).status).toBe(404);
  });

  it('lists the signed-in devices; one or all the others can be signed out', async () => {
    const u = await register();
    const b = (await login(u.email, 'Lama12345')).body.data.refresh_token as string;
    const c = (await login(u.email, 'Lama12345')).body.data.refresh_token as string;

    const list = (await request(app).get(`${API}/auth/me/sessions`).set(u.auth).set(cookie(u.refresh)).expect(200)).body.data;
    expect(list).toHaveLength(3);
    expect(list.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const familyOf = async (refresh: string) => {
      const me = (await request(app).post(`${API}/auth/refresh`).send({ refresh_token: refresh })).body.data;
      return { refresh: me.refresh_token as string };
    };
    const bNext = await familyOf(b); // b rotates; its family is still one device
    const sessions = (await request(app).get(`${API}/auth/me/sessions`).set(u.auth).set(cookie(bNext.refresh))).body.data;
    const bId = sessions.find((s: { current: boolean }) => s.current).id;
    await request(app).delete(`${API}/auth/me/sessions/${bId}`).set(u.auth).expect(200);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: bNext.refresh })).status).toBe(401);
    expect((await request(app).delete(`${API}/auth/me/sessions/${bId}`).set(u.auth)).status).toBe(404);

    const others = await request(app).post(`${API}/auth/me/sessions/revoke-others`).set(u.auth).set(cookie(u.refresh)).expect(200);
    expect(others.body.data.signed_out_devices).toBe(1);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: c })).status).toBe(401);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: u.refresh })).status).toBe(200);
  });

  it('a customer can delete the account: personal data is removed, past orders stay, the email is free again', async () => {
    const owner = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Hapus Shop' });
    expect((await request(app).post(`${API}/auth/me/delete`).set(owner.owner.auth).send({ confirm: 'HAPUS' })).body.error.code).toBe('ACCOUNT_DELETE_NOT_ALLOWED');

    // An account with an open booking has to finish or cancel it first.
    const g = await createUser('CUSTOMER');
    const booked = await request(app)
      .post(`${API}/booking`)
      .set(g.auth)
      .send({ workshop_id: owner.workshopId, service_id: owner.serviceId, booking_date: tomorrow(), time_slot: '10:00' })
      .expect(201);
    expect((await request(app).post(`${API}/auth/me/delete`).set(g.auth).send({ confirm: 'ya' })).body.error.code).toBe('DELETE_CONFIRMATION_REQUIRED');
    expect((await request(app).post(`${API}/auth/me/delete`).set(g.auth).send({ confirm: 'HAPUS' })).body.error.code).toBe('ACCOUNT_HAS_OPEN_ORDERS');
    await request(app).patch(`${API}/orders/${booked.body.data.id}/cancel`).set(g.auth).send({ reason: 'Tidak jadi' }).expect(200);
    await request(app).post(`${API}/auth/me/delete`).set(g.auth).send({ confirm: 'hapus' }).expect(200);
    const order = (await pool.query('SELECT customer_id FROM orders WHERE id = $1', [booked.body.data.id])).rows[0];
    expect(order.customer_id).toBe(g.id); // the workshop keeps its record

    // With a password: it is asked for.
    const u = await register();
    await request(app).post(`${API}/vehicles`).set(u.auth).send({ vehicle_type: 'MOTOR', brand: 'Honda', plate: 'B 1234 XYZ' }).expect(201);
    expect((await request(app).post(`${API}/auth/me/delete`).set(u.auth).send({ confirm: 'HAPUS' })).body.error.code).toBe('PASSWORD_REQUIRED');
    await request(app).post(`${API}/auth/me/delete`).set(u.auth).send({ password: 'Lama12345' }).expect(200);
    await settle();
    expect(mails('Akun BengkelGo Anda sudah dihapus').pop().to).toBe(u.email);

    const row = (await pool.query('SELECT name, email, phone, password_hash, is_active, deleted_at FROM users WHERE id = $1', [u.id])).rows[0];
    expect(row).toMatchObject({ name: 'Pengguna dihapus', email: null, phone: null, password_hash: null, is_active: false });
    expect(row.deleted_at).toBeTruthy();
    expect((await pool.query('SELECT plate FROM vehicles WHERE user_id = $1', [u.id])).rows[0].plate).toBeNull();
    expect((await login(u.email, 'Lama12345')).status).toBe(401);
    expect((await request(app).post(`${API}/auth/refresh`).send({ refresh_token: u.refresh })).status).toBe(401);
    await request(app).post(`${API}/auth/register/customer`).send({ name: 'Sari Lagi', email: u.email, phone: '081234567890', password: 'Lagi12345' }).expect(201);

    // An admin cannot switch a deleted account back on.
    const admin = await createUser('ADMIN');
    const back = await request(app).patch(`${API}/admin/users/${u.id}/active`).set(admin.auth).send({ active: true });
    expect(back.body.error.code).toBe('ACCOUNT_DELETED');
  });
});
