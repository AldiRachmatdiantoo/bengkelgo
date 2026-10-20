import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { sendBookingReminders, sendSoonReminders } from '../../src/jobs/bookingReminder.job';
import { API, createUser, createWorkshop, describeDb, ORIGIN, resetDb, tomorrow } from './helpers';

const app = createApp();

describeDb('Admin access management (BE-15) and booking reminders (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  it('deactivating an account blocks login and refresh at once; it can be switched back on', async () => {
    const admin = await createUser('ADMIN', 'Admin Utama');
    const reg = await request(app).post(`${API}/auth/register/customer`).send({ name: 'Budi Nonaktif', email: 'budi.off@test.local', phone: '081299990000', password: 'Rahasia123' });
    const userId = reg.body.data.user.id;
    const cookie = reg.headers['set-cookie'];

    const list = await request(app).get(`${API}/admin/users`).set(admin.auth).query({ q: 'budi.off' });
    expect(list.body.data).toEqual([expect.objectContaining({ id: userId, role: 'CUSTOMER', is_active: true })]);

    await request(app).patch(`${API}/admin/users/${userId}/active`).set(admin.auth).send({ active: false, reason: 'Laporan penipuan' }).expect(200);
    const login = await request(app).post(`${API}/auth/login`).send({ email: 'budi.off@test.local', password: 'Rahasia123' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    expect((await request(app).post(`${API}/auth/refresh`).set('Cookie', cookie)).status).toBe(401); // session revoked
    expect((await request(app).get(`${API}/admin/users`).set(admin.auth).query({ active: 'false' })).body.data.map((u: { id: string }) => u.id)).toContain(userId);

    await request(app).patch(`${API}/admin/users/${userId}/active`).set(admin.auth).send({ active: true }).expect(200);
    expect((await request(app).post(`${API}/auth/login`).send({ email: 'budi.off@test.local', password: 'Rahasia123' })).status).toBe(200);

    const logs = (await request(app).get(`${API}/admin/audit-logs`).set(admin.auth).query({ entity: 'user', entity_id: userId })).body.data;
    expect(logs.map((l: { action: string }) => l.action)).toEqual(['USER_ACTIVATED', 'USER_DEACTIVATED']);
    expect(logs[1].details.reason).toBe('Laporan penipuan');
  });

  it('protects admins: not yourself, never the last one; new admins can be added; others are refused', async () => {
    await pool.query(`UPDATE users SET is_active = FALSE WHERE role = 'ADMIN'`);
    const admin = await createUser('ADMIN', 'Satu-satunya Admin');
    const self = await request(app).patch(`${API}/admin/users/${admin.id}/active`).set(admin.auth).send({ active: false });
    expect(self.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');

    const created = await request(app).post(`${API}/admin/users/admins`).set(admin.auth).send({ name: 'Admin Kedua', email: 'admin2@test.local', password: 'Rahasia123' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ role: 'ADMIN', is_active: true });
    expect((await request(app).post(`${API}/admin/users/admins`).set(admin.auth).send({ name: 'Dobel', email: 'admin2@test.local', password: 'Rahasia123' })).body.error.code).toBe('EMAIL_TAKEN');
    expect((await request(app).post(`${API}/admin/users/admins`).set(admin.auth).send({ name: 'Lemah', email: 'weak@test.local', password: 'pendek' })).status).toBe(400);
    expect((await request(app).post(`${API}/auth/login`).send({ email: 'admin2@test.local', password: 'Rahasia123' })).body.data.user.role).toBe('ADMIN');

    // With two admins, one may switch the other off; the remaining one can't be switched off.
    await request(app).patch(`${API}/admin/users/${created.body.data.id}/active`).set(admin.auth).send({ active: false }).expect(200);
    const other = await createUser('ADMIN', 'Admin Ketiga');
    await pool.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [admin.id]); // only "other" left active
    const last = await request(app).patch(`${API}/admin/users/${other.id}/active`).set(admin.auth).send({ active: false });
    expect(last.body.error.code).toBe('LAST_ADMIN');

    const owner = await createUser('WORKSHOP_OWNER');
    expect((await request(app).get(`${API}/admin/users`).set(owner.auth)).status).toBe(403);
  });

  it('2-hour reminder: in-app notification once, only for confirmed bookings starting within 2 hours', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Reminder Shop' });
    const c = await createUser('CUSTOMER');
    const book = (slot: string) =>
      request(app).post(`${API}/booking`).set(c.auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: slot });
    const soon = (await book('10:00')).body.data;
    const later = (await book('11:00')).body.data;
    // Move them to "in about an hour" and "in about three hours" (WIB), bypassing slot rules on purpose.
    const at = (mins: number) =>
      pool.query(
        `UPDATE booking_details SET booking_date = ((NOW() + make_interval(mins => $2)) AT TIME ZONE 'Asia/Jakarta')::date,
           time_slot = ((NOW() + make_interval(mins => $2)) AT TIME ZONE 'Asia/Jakarta')::time WHERE order_id = $1`,
        [mins === 60 ? soon.id : later.id, mins],
      );
    await at(60);
    await at(180);

    const first = await sendSoonReminders();
    expect(first).toEqual({ sent: 1, failed: 0 });
    expect(await sendSoonReminders()).toEqual({ sent: 0, failed: 0 });
    const notes = (await request(app).get(`${API}/notifications`).set(c.auth)).body.data.items as { type: string; link: string }[];
    expect(notes.filter((n) => n.type === 'BOOKING_SOON')).toEqual([expect.objectContaining({ link: `/orders/${soon.id}` })]);
  });

  it('day-before reminder also creates one in-app notification', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Tomorrow Shop' });
    const c = await createUser('CUSTOMER');
    const order = (await request(app).post(`${API}/booking`).set(c.auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: '15:00' })).body.data;
    await sendBookingReminders();
    await sendBookingReminders();
    const notes = (await request(app).get(`${API}/notifications`).set(c.auth)).body.data.items as { type: string; link: string }[];
    expect(notes.filter((n) => n.type === 'BOOKING_TOMORROW')).toEqual([expect.objectContaining({ link: `/orders/${order.id}` })]);
  });
});
