import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { sendBookingReminders } from '../../src/jobs/bookingReminder.job';
import { API, createUser, createWorkshop, describeDb, ORIGIN, PNG, resetDb, tomorrow } from './helpers';

const app = createApp();

describeDb('Booking engine, payments & reviews (integration)', () => {
  let ws: Awaited<ReturnType<typeof createWorkshop>>;

  beforeAll(async () => {
    await resetDb();
    ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, maxSlot: 3, mechanics: [{ name: 'M1' }, { name: 'M2' }, { name: 'M3' }] });
  });
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const book = (auth: Record<string, string>, slot = '10:00') =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: slot });

  it('50 concurrent bookings on a 3-unit slot: exactly 3 CONFIRMED, zero overbooking (FOR UPDATE)', async () => {
    const customers = await Promise.all(Array.from({ length: 50 }, () => createUser('CUSTOMER')));
    const results = await Promise.all(customers.map((c) => book(c.auth, '10:00')));

    expect(results.every((r) => r.status === 201)).toBe(true);
    const statuses = results.map((r) => r.body.data.status);
    expect(statuses.filter((s) => s === 'CONFIRMED')).toHaveLength(3);
    expect(statuses.filter((s) => s === 'IN_QUEUE')).toHaveLength(47);

    const { rows } = await pool.query(`SELECT current_booked, max_slot_per_hour FROM workshop_quotas WHERE workshop_id = $1 AND slot_time = '10:00'`, [ws.workshopId]);
    expect(rows[0]).toEqual({ current_booked: 3, max_slot_per_hour: 3 });

    // Queue numbers are unique and gap-free
    const queue = results.map((r) => r.body.data.booking.queue_number).sort((a, b) => a - b);
    expect(queue).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

    // Each confirmed booking got a distinct mechanic
    const mech = await pool.query(`SELECT DISTINCT mechanic_id FROM orders WHERE status = 'CONFIRMED' AND mechanic_id IS NOT NULL`);
    expect(mech.rowCount).toBe(3);
  });

  it('rejects a duplicate booking by the same customer in the same slot', async () => {
    const c = await createUser('CUSTOMER');
    expect((await book(c.auth, '11:00')).status).toBe(201);
    expect((await book(c.auth, '11:00')).status).toBe(409);
  });

  it('cancelling a CONFIRMED booking frees quota and promotes the first waitlisted booking', async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => createUser('CUSTOMER')));
    const orders = [];
    for (const u of users) orders.push((await book(u.auth, '13:00')).body.data);
    expect(orders.map((o) => o.status)).toEqual(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'IN_QUEUE']);

    const cancel = await request(app).patch(`${API}/orders/${orders[0].id}/cancel`).set(users[0].auth);
    expect(cancel.status).toBe(200);

    const promoted = await request(app).get(`${API}/orders/${orders[3].id}`).set(users[3].auth);
    expect(promoted.body.data.status).toBe('CONFIRMED');
    expect(promoted.body.data.mechanic).not.toBeNull();
    const { rows } = await pool.query(`SELECT current_booked FROM workshop_quotas WHERE workshop_id = $1 AND slot_time = '13:00'`, [ws.workshopId]);
    expect(rows[0].current_booked).toBe(3);
  });

  it('owner can raise slot capacity which promotes waitlisted bookings, but never below booked', async () => {
    const low = await request(app).put(`${API}/workshops/quotas`).set(ws.owner.auth).send({ date: tomorrow(), time_slot: '10:00', max_slot_per_hour: 2 });
    expect(low.status).toBe(422);
    const up = await request(app).put(`${API}/workshops/quotas`).set(ws.owner.auth).send({ date: tomorrow(), time_slot: '10:00', max_slot_per_hour: 5 });
    expect(up.status).toBe(200);
    expect(up.body.data).toMatchObject({ current_booked: 5, promoted_from_queue: 2 });
  });

  it('full flow: book -> QRIS proof upload -> verify -> complete -> review updates mechanic rating', async () => {
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, '15:00')).body.data;
    expect(order.status).toBe('CONFIRMED');

    // Non-image is rejected (magic bytes), oversize rejected (> 2MB)
    const fake = await request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id).attach('proof', Buffer.from('<html>'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const tooBig = await request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id).attach('proof', big, { filename: 'a.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    // Another customer cannot upload for this order (BOLA)
    const stranger = await createUser('CUSTOMER');
    const bola = await request(app).post(`${API}/payments/upload`).set(stranger.auth).field('order_id', order.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' });
    expect(bola.status).toBe(404);

    const up = await request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect(up.body.data.status).toBe('PENDING_VERIFICATION');

    const verify = await request(app).patch(`${API}/payments/${order.id}/verify`).set(ws.owner.auth).send({ approve: true });
    expect(verify.body.data.status).toBe('VERIFIED');

    expect((await request(app).post(`${API}/reviews`).set(c.auth).send({ order_id: order.id, rating: 5 })).status).toBe(409); // not completed yet
    await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'COMPLETED' }).expect(200);

    const review = await request(app).post(`${API}/reviews`).set(c.auth).send({ order_id: order.id, rating: 4, comment: 'Mantap <b>cepat</b>' });
    expect(review.status).toBe(201);
    expect(review.body.data.comment).toBe('Mantap bcepat/b');
    expect((await request(app).post(`${API}/reviews`).set(c.auth).send({ order_id: order.id, rating: 5 })).status).toBe(409);

    const { rows } = await pool.query('SELECT m.avg_rating, m.total_reviews, w.avg_rating AS w_rating FROM orders o JOIN mechanics m ON m.id = o.mechanic_id JOIN workshops w ON w.id = o.workshop_id WHERE o.id = $1', [order.id]);
    expect(rows[0]).toEqual({ avg_rating: 4, total_reviews: 1, w_rating: 4 });
  });

  it('cron reminder marks tomorrow bookings reminder_sent exactly once', async () => {
    const first = await sendBookingReminders();
    expect(first.sent).toBeGreaterThan(0);
    const second = await sendBookingReminders();
    expect(second.sent).toBe(0);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM booking_details bd JOIN orders o ON o.id = bd.order_id WHERE o.status = 'CONFIRMED' AND bd.reminder_sent = FALSE`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('report day boundaries follow WIB, not the DB session timezone', async () => {
    const tz = await pool.query<{ timezone: string }>("SELECT current_setting('TimeZone') AS timezone");
    expect(tz.rows[0].timezone).toMatch(/UTC/); // the DB itself runs in UTC; WIB must come from the query
    const customer = await createUser('CUSTOMER');
    const admin = await createUser('ADMIN');
    // 2026-06-10 18:30 UTC == 2026-06-11 01:30 WIB -> belongs to 11 June in the report
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO orders (order_number, type, status, customer_id, workshop_id, vehicle_type, total_amount, created_at)
       VALUES ('TZ-TEST-1', 'EMERGENCY', 'COMPLETED', $1, $2, 'MOTOR', 12345, '2026-06-10T18:30:00Z') RETURNING id`,
      [customer.id, ws.workshopId],
    );
    await pool.query(`INSERT INTO transactions (order_id, amount, status) VALUES ($1, 12345, 'VERIFIED')`, [rows[0].id]);

    const day = (d: string) => request(app).get(`${API}/admin/reports/transactions?from=${d}&to=${d}`).set(admin.auth);
    const june11 = await day('2026-06-11');
    expect(june11.body.data.summary.verified_revenue).toBe(12345);
    expect(june11.body.data.daily).toEqual([{ date: '2026-06-11', orders: 1, verified_revenue: 12345 }]);
    expect((await day('2026-06-10')).body.data.summary.total_orders).toBe(0);

    // Owner's order list: emergency orders are filtered by their creation day in WIB
    const owned = (d: string) => request(app).get(`${API}/orders/workshop?date=${d}&type=EMERGENCY`).set(ws.owner.auth);
    expect((await owned('2026-06-11')).body.data.map((o: { id: string }) => o.id)).toEqual([rows[0].id]);
    expect((await owned('2026-06-10')).body.data).toHaveLength(0);
    await pool.query(`DELETE FROM orders WHERE id = $1`, [rows[0].id]);
  });

  it('admin transaction report aggregates verified revenue', async () => {
    const admin = await createUser('ADMIN');
    const res = await request(app).get(`${API}/admin/reports/transactions`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.verified_revenue).toBe(75000);
    expect(res.body.data.summary.verified_payments).toBe(1);
  });
});
