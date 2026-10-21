import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { addDays, localNow } from '../../src/common/utils/time';
import { API, createUser, createWorkshop, describeDb, ORIGIN, tomorrow, resetDb } from './helpers';

/** Booking abuse guards: unfinished bookings per customer, one per workshop per day, attempts per hour. */
const app = createApp();

describeDb('Booking abuse guards (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  type Shop = Awaited<ReturnType<typeof createWorkshop>>;
  const book = (auth: Record<string, string>, ws: Shop, slot: string, date = tomorrow()) =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: date, time_slot: slot });
  const shops = (n: number, tag: string) => Promise.all(Array.from({ length: n }, (_, i) => createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: `${tag} ${i + 1}` })));

  it('one unfinished booking per workshop per day (another day, or after cancelling, is fine)', async () => {
    const [ws] = await shops(1, 'Daily Shop');
    const c = await createUser('CUSTOMER');
    const first = (await book(c.auth, ws, '10:00')).body.data;

    const sameDay = await book(c.auth, ws, '11:00');
    expect(sameDay.status).toBe(409);
    expect(sameDay.body.error.code).toBe('DAILY_WORKSHOP_LIMIT');
    expect((await book(c.auth, ws, '10:00')).body.error.code).toBe('DUPLICATE_BOOKING'); // the exact slot keeps its own code

    expect((await book(c.auth, ws, '10:00', addDays(localNow().date, 2))).status).toBe(201);

    await request(app).patch(`${API}/orders/${first.id}/cancel`).set(c.auth).expect(200);
    expect((await book(c.auth, ws, '11:00')).status).toBe(201);
  });

  it('rescheduling onto a day that already has a booking at the same workshop is refused', async () => {
    const [ws] = await shops(1, 'Move Shop');
    const c = await createUser('CUSTOMER');
    const dayAfter = addDays(localNow().date, 2);
    const a = (await book(c.auth, ws, '10:00')).body.data;
    await book(c.auth, ws, '10:00', dayAfter).expect(201);

    const clash = await request(app).patch(`${API}/orders/${a.id}/reschedule`).set(c.auth).send({ booking_date: dayAfter, time_slot: '12:00' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('DAILY_WORKSHOP_LIMIT');
    // Moving within its own day is still allowed.
    await request(app).patch(`${API}/orders/${a.id}/reschedule`).set(c.auth).send({ booking_date: tomorrow(), time_slot: '12:00' }).expect(200);
  });

  it('at most 3 unfinished bookings at once, even when sent at the same moment', async () => {
    const ws = await shops(5, 'Limit Shop');
    const c = await createUser('CUSTOMER');
    const results = await Promise.all(ws.map((w) => book(c.auth, w, '10:00')));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409).map((r) => r.body.error.code)).toEqual(['ACTIVE_BOOKING_LIMIT', 'ACTIVE_BOOKING_LIMIT']);

    // Cancelling one frees a place.
    memoryStore.reset();
    const done = results.find((r) => r.status === 201)!.body.data;
    await request(app).patch(`${API}/orders/${done.id}/cancel`).set(c.auth).expect(200);
    const freeShop = ws[results.findIndex((r) => r.status === 409)];
    expect((await book(c.auth, freeShop, '10:00')).status).toBe(201);
  });

  it('at most 5 booking attempts per account per hour, counted per account (not per network)', async () => {
    const ws = await shops(1, 'Rate Shop');
    const c = await createUser('CUSTOMER');
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await book(c.auth, ws[0], `${String(9 + i).padStart(2, '0')}:00`)).status);
    expect(codes).toEqual([201, 409, 409, 409, 409]); // one booking per day here, but every attempt counts
    const blocked = await book(c.auth, ws[0], '15:00');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('BOOKING_RATE_LIMITED');

    // Another customer on the same IP is unaffected.
    const other = await createUser('CUSTOMER');
    expect((await book(other.auth, ws[0], '16:00')).status).toBe(201);
    // Malformed requests don't use up attempts.
    expect((await request(app).post(`${API}/booking`).set(other.auth).send({ workshop_id: 'x' })).status).toBe(400);
  });
});
