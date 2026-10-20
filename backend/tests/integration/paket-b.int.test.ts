import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { addDays, localNow } from '../../src/common/utils/time';
import { weekdayOf } from '../../src/features/booking/booking.logic';
import { API, createUser, createWorkshop, describeDb, ORIGIN, PNG, pointAt, resetDb, tomorrow } from './helpers';

/** Backlog "Paket B": notifications, timeline, audit log, stats, search, health, schedule, slots, vehicles, photos, reschedule. */
const app = createApp();
const sos = { latitude: ORIGIN.lat, longitude: ORIGIN.lng, vehicle_type: 'MOTOR', problem_description: 'Ban bocor di jalan tol' };
const notifTypes = async (auth: Record<string, string>) =>
  ((await request(app).get(`${API}/notifications`).set(auth)).body.data.items as { type: string }[]).map((n) => n.type);

describeDb('Backlog paket B (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const book = (auth: Record<string, string>, ws: { workshopId: string; serviceId: string }, slot: string, date = tomorrow(), extra: object = {}) =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: date, time_slot: slot, ...extra });

  it('10-12. notifications, status timeline with actors, and an append-only audit log', async () => {
    const ws = await createWorkshop({ ...(await pointAt(600, 10)), name: 'Notif Shop', mechanics: [{ name: 'Tono' }] });
    const admin = await createUser('ADMIN');
    const guest = await createUser('GUEST', 'Tamu Notif');

    const em = (await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos)).body.data;
    expect(await notifTypes(ws.owner.auth)).toContain('SOS_INCOMING');
    await request(app).patch(`${API}/emergency/${em.id}/respond`).set(ws.owner.auth).send({ action: 'ACCEPT', estimated_price: 90000 }).expect(200);
    await request(app).post(`${API}/payments/upload`).set(guest.auth).field('order_id', em.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(200);
    await request(app).patch(`${API}/payments/${em.id}/verify`).set(ws.owner.auth).send({ approve: true }).expect(200);
    await request(app).patch(`${API}/orders/${em.id}/status`).set(ws.owner.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    await request(app).patch(`${API}/orders/${em.id}/status`).set(ws.owner.auth).send({ status: 'COMPLETED' }).expect(200);

    expect(await notifTypes(guest.auth)).toEqual(expect.arrayContaining(['SOS_ACCEPTED', 'PAYMENT_VERIFIED', 'ORDER_IN_PROGRESS', 'ORDER_COMPLETED']));
    expect(await notifTypes(ws.owner.auth)).toEqual(expect.arrayContaining(['SOS_INCOMING', 'PAYMENT_PROOF']));

    // Mark read: one, then all; nobody can touch someone else's.
    const list = (await request(app).get(`${API}/notifications`).set(guest.auth)).body.data;
    expect(list.unread).toBe(list.items.length);
    await request(app).patch(`${API}/notifications/read`).set(ws.owner.auth).send({ ids: [list.items[0].id] }).expect(200);
    expect((await request(app).get(`${API}/notifications`).set(guest.auth)).body.data.unread).toBe(list.items.length);
    await request(app).patch(`${API}/notifications/read`).set(guest.auth).send({ ids: [list.items[0].id] }).expect(200);
    expect((await request(app).get(`${API}/notifications`).set(guest.auth)).body.data.unread).toBe(list.items.length - 1);
    await request(app).patch(`${API}/notifications/read`).set(guest.auth).send({}).expect(200);
    expect((await request(app).get(`${API}/notifications`).set(guest.auth).query({ unread_only: 'true' })).body.data.items).toEqual([]);

    // Timeline: order + payment changes, each with who did it.
    const history = (await request(app).get(`${API}/orders/${em.id}/history`).set(guest.auth)).body.data as {
      kind: string; from_status: string | null; to_status: string; actor_role: string | null; actor_name: string | null;
    }[];
    expect(history.map((h) => `${h.kind}:${h.to_status}`)).toEqual([
      'ORDER:PENDING', 'ORDER:ACCEPTED', 'PAYMENT:PENDING_VERIFICATION', 'PAYMENT:VERIFIED', 'ORDER:IN_PROGRESS', 'ORDER:COMPLETED',
    ]);
    expect(history[0]).toMatchObject({ actor_role: 'GUEST', actor_name: 'Tamu Notif' });
    expect(history[1]).toMatchObject({ from_status: 'PENDING', actor_role: 'WORKSHOP_OWNER' });
    const stranger = await createUser('CUSTOMER');
    expect((await request(app).get(`${API}/orders/${em.id}/history`).set(stranger.auth)).status).toBe(404);

    // Audit: payment verification + admin approval are recorded, and the log can't be rewritten.
    const pending = await createWorkshop({ lat: 0, lng: 0, name: 'Audit Pending', status: 'PENDING' });
    await request(app).patch(`${API}/admin/workshops/${pending.workshopId}/approval`).set(admin.auth).send({ action: 'APPROVE' }).expect(200);
    expect(await notifTypes(pending.owner.auth)).toContain('WORKSHOP_APPROVED');
    const logs = (await request(app).get(`${API}/admin/audit-logs`).set(admin.auth)).body.data as { action: string; entity_id: string }[];
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['PAYMENT_VERIFIED', 'WORKSHOP_APPROVE']));
    expect((await request(app).get(`${API}/admin/audit-logs`).set(admin.auth).query({ entity: 'order', entity_id: em.id })).body.data).toHaveLength(1);
    await expect(pool.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
    await expect(pool.query(`UPDATE audit_logs SET action = 'X'`)).rejects.toThrow(/append-only/);
    expect((await request(app).get(`${API}/admin/audit-logs`).set(ws.owner.auth)).status).toBe(403);
  });

  it('10. a new workshop registration notifies the admins', async () => {
    const admin = await createUser('ADMIN');
    const res = await request(app).post(`${API}/auth/register/workshop`).send({
      owner: { name: 'Pemilik Baru', email: `baru${Date.now()}@test.local`, phone: '081277778888', password: 'Bengkel123' },
      workshop: { name: 'Bengkel Daftar Baru', address: 'Jl. Baru No. 2', phone: '081277778889', latitude: -6.21, longitude: 106.82, vehicle_types: ['MOTOR'], open_time: '08:00', close_time: '17:00', max_slot_per_hour: 2 },
    });
    expect(res.status).toBe(201);
    expect(await notifTypes(admin.auth)).toContain('WORKSHOP_REGISTERED');
  });

  it('16. weekly closed day, break and holidays close slots; the old frontend sees them as not bookable', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Schedule Shop' });
    const d1 = addDays(localNow().date, 2);
    const d2 = addDays(localNow().date, 3);
    await request(app).put(`${API}/workshops/profile`).set(ws.owner.auth).send({ closed_weekdays: [weekdayOf(d1)], break_start: '12:00', break_end: '13:00' }).expect(200);
    expect((await request(app).put(`${API}/workshops/profile`).set(ws.owner.auth).send({ break_start: '12:00' })).status).toBe(400);
    const c = await createUser('CUSTOMER');

    const closed = await book(c.auth, ws, '10:00', d1);
    expect(closed.status).toBe(422);
    expect(closed.body.error.code).toBe('WORKSHOP_CLOSED_DAY');
    expect((await book(c.auth, ws, '12:00', d2)).body.error.code).toBe('DURING_BREAK');

    const slots = (await request(app).get(`${API}/workshops/${ws.workshopId}/availability`).query({ date: d2 })).body.data as { time_slot: string; bookable: boolean; unavailable_reason: string | null }[];
    expect(slots.find((s) => s.time_slot === '12:00')).toMatchObject({ bookable: false, unavailable_reason: 'DURING_BREAK' });
    expect(slots.find((s) => s.time_slot === '10:00')).toMatchObject({ bookable: true, unavailable_reason: null });

    const holiday = (await request(app).post(`${API}/workshops/holidays`).set(ws.owner.auth).send({ date: d2, note: 'Cuti bersama' })).body.data;
    expect((await book(c.auth, ws, '10:00', d2)).body.error.code).toBe('WORKSHOP_CLOSED_DAY');
    expect((await request(app).get(`${API}/workshops/holidays`).set(ws.owner.auth)).body.data).toEqual([{ id: holiday.id, holiday_date: d2, note: 'Cuti bersama' }]);
    await request(app).delete(`${API}/workshops/holidays/${holiday.id}`).set(ws.owner.auth).expect(200);
    expect((await book(c.auth, ws, '10:00', d2)).status).toBe(201);
    const other = await createWorkshop({ lat: 0, lng: 0, name: 'Other' });
    expect((await request(app).delete(`${API}/workshops/holidays/${holiday.id}`).set(other.owner.auth)).status).toBe(404);
  });

  it('17. find workshops with room in a slot, and the next free slot of a workshop', async () => {
    await pool.query(`UPDATE workshops SET status = 'SUSPENDED'`);
    const full = await createWorkshop({ ...(await pointAt(300, 0)), name: 'Penuh', maxSlot: 1 });
    const free = await createWorkshop({ ...(await pointAt(900, 0)), name: 'Kosong', maxSlot: 1 });
    const c = await createUser('CUSTOMER');
    await book(c.auth, full, '14:00').expect(201);
    const names = async (q: object) => ((await request(app).get(`${API}/workshops`).query(q)).body.data as { name: string }[]).map((w) => w.name).sort();
    expect(await names({ date: tomorrow(), time_slot: '14:00' })).toEqual(['Kosong']);
    expect(await names({ date: tomorrow(), time_slot: '15:00' })).toEqual(['Kosong', 'Penuh']);
    expect(await names({ date: tomorrow(), time_slot: '23:00' })).toEqual([]); // after closing
    expect((await request(app).get(`${API}/workshops`).query({ date: tomorrow() })).status).toBe(400);

    // Next free slot from tomorrow = opening hour; a closed workshop has none.
    const next = (await request(app).get(`${API}/workshops/${free.workshopId}/next-slot`).query({ from: tomorrow() })).body.data;
    expect(next).toMatchObject({ booking_date: tomorrow(), time_slot: '07:00', remaining: 1 });
    await pool.query(`UPDATE workshops SET is_open = FALSE WHERE id = $1`, [free.workshopId]);
    expect((await request(app).get(`${API}/workshops/${free.workshopId}/next-slot`)).body.data).toBeNull();
  });

  it('18. saved vehicles: CRUD, attach to booking and SOS, type must match, owner-only', async () => {
    const ws = await createWorkshop({ ...(await pointAt(400, 200)), name: 'Vehicle Shop' });
    const c = await createUser('CUSTOMER');
    const motor = (await request(app).post(`${API}/vehicles`).set(c.auth).send({ vehicle_type: 'MOTOR', brand: 'Honda', model: 'Vario 125', year: 2021, color: 'Hitam', plate: 'b 1234 xyz' })).body.data;
    expect(motor.plate).toBe('B 1234 XYZ');
    const car = (await request(app).post(`${API}/vehicles`).set(c.auth).send({ vehicle_type: 'MOBIL', brand: 'Toyota' })).body.data;
    expect((await request(app).get(`${API}/vehicles`).set(c.auth)).body.data).toHaveLength(2);
    const other = await createUser('CUSTOMER');
    expect((await request(app).patch(`${API}/vehicles/${motor.id}`).set(other.auth).send({ color: 'Merah' })).status).toBe(404);
    expect((await request(app).patch(`${API}/vehicles/${motor.id}`).set(c.auth).send({ color: 'Merah' })).body.data).toMatchObject({ color: 'Merah', model: 'Vario 125' });

    const mismatch = await book(c.auth, ws, '09:00', tomorrow(), { vehicle_id: car.id });
    expect(mismatch.body.error.code).toBe('VEHICLE_TYPE_MISMATCH');
    const order = (await book(c.auth, ws, '09:00', tomorrow(), { vehicle_id: motor.id })).body.data;
    expect(order.vehicle_plate).toBe('B 1234 XYZ');
    const detail = (await request(app).get(`${API}/orders/${order.id}`).set(c.auth)).body.data;
    expect(detail.vehicle).toMatchObject({ id: motor.id, brand: 'Honda', model: 'Vario 125', color: 'Merah' });

    const em = await request(app).post(`${API}/emergency/request`).set(c.auth).send({ ...sos, vehicle_id: motor.id, problem_category: 'TIRE' });
    expect(em.status).toBe(201);
    const emDetail = (await request(app).get(`${API}/orders/${em.body.data.id}`).set(c.auth)).body.data;
    expect(emDetail.emergency.problem_category).toBe('TIRE');
    expect(emDetail.vehicle.id).toBe(motor.id);
    expect((await request(app).post(`${API}/emergency/request`).set(c.auth).send({ ...sos, problem_category: 'ALIEN' })).status).toBe(400);

    await request(app).delete(`${API}/vehicles/${motor.id}`).set(c.auth).expect(200);
    expect((await request(app).get(`${API}/vehicles`).set(c.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/orders/${order.id}`).set(c.auth)).body.data.vehicle.id).toBe(motor.id); // history kept
  });

  it('19. workshop & mechanic photos: upload, cover, public image, limits, cleanup', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Photo Shop' });
    const up = () => request(app).post(`${API}/workshops/photos`).set(ws.owner.auth).attach('photo', PNG, { filename: 'f.png', contentType: 'image/png' });
    const first = (await up()).body.data;
    const second = (await up()).body.data;
    expect(first.is_cover).toBe(true);
    expect(second.is_cover).toBe(false);
    expect((await request(app).post(`${API}/workshops/photos`).set(ws.owner.auth).attach('photo', Buffer.from('<svg/>'), { filename: 'x.png', contentType: 'image/png' })).status).toBe(400);

    const img = await request(app).get(`${API}/workshops/${ws.workshopId}/photos/${first.id}`);
    expect(img.status).toBe(200);
    expect(img.headers['cross-origin-resource-policy']).toBe('cross-origin');
    await request(app).patch(`${API}/workshops/photos/${second.id}/cover`).set(ws.owner.auth).expect(200);
    const detail = (await request(app).get(`${API}/workshops/${ws.workshopId}`)).body.data;
    expect(detail.photos[0]).toMatchObject({ id: second.id, is_cover: true });

    // Deleting the cover promotes another photo; the file is removed from disk.
    await request(app).delete(`${API}/workshops/photos/${second.id}`).set(ws.owner.auth).expect(200);
    expect((await request(app).get(`${API}/workshops/photos`).set(ws.owner.auth)).body.data).toEqual([expect.objectContaining({ id: first.id, is_cover: true })]);
    expect((await request(app).get(`${API}/workshops/${ws.workshopId}/photos/${second.id}`)).status).toBe(404);

    for (let i = 0; i < 9; i++) await up().expect(201);
    expect((await up()).body.error.code).toBe('PHOTO_LIMIT');

    const [mechanicId] = ws.mechanicIds;
    await request(app).put(`${API}/workshops/mechanics/${mechanicId}/photo`).set(ws.owner.auth).attach('photo', PNG, { filename: 'm.png', contentType: 'image/png' }).expect(200);
    const mech = (await request(app).get(`${API}/workshops/${ws.workshopId}`)).body.data.mechanics[0];
    expect(mech.photo_url).toBe(`/workshops/${ws.workshopId}/mechanics/${mechanicId}/photo`);
    expect((await request(app).get(`${API}${mech.photo_url}`)).status).toBe(200);
    const other = await createWorkshop({ lat: 0, lng: 0, name: 'Other Photo' });
    expect((await request(app).put(`${API}/workshops/mechanics/${mechanicId}/photo`).set(other.owner.auth).attach('photo', PNG, { filename: 'm.png', contentType: 'image/png' })).status).toBe(404);
    await request(app).delete(`${API}/workshops/mechanics/${mechanicId}/photo`).set(ws.owner.auth).expect(200);
    expect((await request(app).get(`${API}${mech.photo_url}`)).status).toBe(404);

    // Photos of unapproved workshops are not public.
    await pool.query(`UPDATE workshops SET status = 'SUSPENDED' WHERE id = $1`, [ws.workshopId]);
    expect((await request(app).get(`${API}/workshops/${ws.workshopId}/photos/${first.id}`)).status).toBe(404);
  });

  it('21. reschedule moves the booking, frees the old slot for the waitlist and joins the new one', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Reschedule Shop', maxSlot: 1, mechanics: [{ name: 'A' }, { name: 'B' }] });
    const [a, b, c] = [await createUser('CUSTOMER'), await createUser('CUSTOMER'), await createUser('CUSTOMER')];
    const mine = (await book(a.auth, ws, '10:00')).body.data;
    const waiting = (await book(b.auth, ws, '10:00')).body.data;
    expect(waiting.status).toBe('IN_QUEUE');
    await book(c.auth, ws, '11:00').expect(201); // 11:00 is now full too

    const res = await request(app).patch(`${API}/orders/${mine.id}/reschedule`).set(a.auth).send({ booking_date: tomorrow(), time_slot: '11:00' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'IN_QUEUE', previous: { time_slot: '10:00' }, booking: { time_slot: '11:00', waitlist_position: 1 } });
    // The freed 10:00 unit went to the waitlisted customer.
    expect((await request(app).get(`${API}/orders/${waiting.id}`).set(b.auth)).body.data.status).toBe('CONFIRMED');
    expect(await notifTypes(b.auth)).toContain('BOOKING_PROMOTED');
    expect(await notifTypes(ws.owner.auth)).toContain('BOOKING_RESCHEDULED');
    const q = await pool.query(`SELECT to_char(slot_time,'HH24:MI') AS t, current_booked FROM workshop_quotas WHERE workshop_id = $1 ORDER BY 1`, [ws.workshopId]);
    expect(q.rows).toEqual([{ t: '10:00', current_booked: 1 }, { t: '11:00', current_booked: 1 }]);

    // Rules
    expect((await request(app).patch(`${API}/orders/${mine.id}/reschedule`).set(a.auth).send({ booking_date: tomorrow(), time_slot: '11:00' })).body.error.code).toBe('SAME_SLOT');
    expect((await request(app).patch(`${API}/orders/${mine.id}/reschedule`).set(b.auth).send({ booking_date: tomorrow(), time_slot: '15:00' })).status).toBe(404);
    expect((await request(app).patch(`${API}/orders/${mine.id}/reschedule`).set(a.auth).send({ booking_date: tomorrow(), time_slot: '23:00' })).body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
    const moved = await request(app).patch(`${API}/orders/${mine.id}/reschedule`).set(a.auth).send({ booking_date: addDays(tomorrow(), 1), time_slot: '09:00' });
    expect(moved.body.data).toMatchObject({ status: 'CONFIRMED', booking: { booking_date: addDays(tomorrow(), 1), time_slot: '09:00', queue_number: 1 } });
    const history = (await request(app).get(`${API}/orders/${mine.id}/history`).set(a.auth)).body.data.map((h: { to_status: string }) => h.to_status);
    expect(history).toEqual(['CONFIRMED', 'IN_QUEUE', 'CONFIRMED']);
  });

  it('21. two customers swapping slots at the same time neither deadlock nor overbook', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Swap Shop', maxSlot: 1 });
    const [a, b] = [await createUser('CUSTOMER'), await createUser('CUSTOMER')];
    const oa = (await book(a.auth, ws, '16:00')).body.data;
    const ob = (await book(b.auth, ws, '17:00')).body.data;
    for (let round = 0; round < 5; round++) {
      const [ra, rb] = await Promise.all([
        request(app).patch(`${API}/orders/${oa.id}/reschedule`).set(a.auth).send({ booking_date: tomorrow(), time_slot: round % 2 ? '16:00' : '17:00' }),
        request(app).patch(`${API}/orders/${ob.id}/reschedule`).set(b.auth).send({ booking_date: tomorrow(), time_slot: round % 2 ? '17:00' : '16:00' }),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]); // a deadlock would surface as 409 CONCURRENCY_CONFLICT
      const q = await pool.query<{ n: number }>(`SELECT current_booked AS n FROM workshop_quotas WHERE workshop_id = $1`, [ws.workshopId]);
      expect(q.rows.every((r) => r.n <= 1)).toBe(true);
    }
  });

  it('13-15. stats, admin search and health', async () => {
    const admin = await createUser('ADMIN');
    const pub = (await request(app).get(`${API}/stats/public`)).body.data;
    expect(pub).toEqual(expect.objectContaining({ active_workshops: expect.any(Number), completed_orders: expect.any(Number) }));
    expect(pub.completed_orders).toBeGreaterThanOrEqual(1);

    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Stats Shop Unik' });
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '10:00')).body.data;
    const own = (await request(app).get(`${API}/workshops/me/stats`).set(ws.owner.auth).query({ date: tomorrow() })).body.data;
    expect(own).toMatchObject({ date: tomorrow(), bookings: 1, quota_booked: 1, quota_capacity: 3 });
    expect(own.quota_utilization).toBeCloseTo(0.333, 2);

    const st = (await request(app).get(`${API}/admin/stats`).set(admin.auth)).body.data;
    expect(st.workshops_by_status.APPROVED).toBeGreaterThanOrEqual(1);
    expect(st.users_by_role.ADMIN).toBeGreaterThanOrEqual(1);

    const found = (await request(app).get(`${API}/admin/search`).set(admin.auth).query({ q: 'Stats Shop' })).body.data;
    expect(found.workshops.map((w: { name: string }) => w.name)).toContain('Stats Shop Unik');
    const byNumber = (await request(app).get(`${API}/admin/search`).set(admin.auth).query({ q: order.order_number })).body.data;
    expect(byNumber.orders[0].id).toBe(order.id);
    expect((await request(app).get(`${API}/admin/search`).set(admin.auth).query({ q: '%' })).status).toBe(400);
    expect((await request(app).get(`${API}/admin/search`).set(admin.auth).query({ q: '%%' })).body.data.workshops).toEqual([]); // wildcards are literal

    const health = (await request(app).get(`${API}/admin/health`).set(admin.auth)).body.data;
    expect(health.database.ok).toBe(true);
    expect(health.postgis.version).toMatch(/^\d/);
    expect(health.migrations).toEqual(expect.arrayContaining(['004_backlog_paket_b.sql']));
    expect((await request(app).get(`${API}/admin/health`).set(c.auth)).status).toBe(403);
  });
});
