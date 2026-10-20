import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { emergencyRepository } from '../../src/features/emergency/emergency.repository';
import { emergencyService } from '../../src/features/emergency/emergency.service';
import { API, count, createUser, createWorkshop, describeDb, ORIGIN, pointAt, resetDb } from './helpers';

const app = createApp();
const sos = { latitude: ORIGIN.lat, longitude: ORIGIN.lng, vehicle_type: 'MOTOR', problem_description: 'Ban bocor di jalan' };

describeDb('Emergency engine (integration)', () => {
  let near: Awaited<ReturnType<typeof createWorkshop>>;
  let second: Awaited<ReturnType<typeof createWorkshop>>;
  let outside: Awaited<ReturnType<typeof createWorkshop>>;

  beforeAll(async () => {
    await resetDb();
    const p49 = await pointAt(4900, 90);
    const p51 = await pointAt(5100, 180);
    const p1 = await pointAt(1000, 0);
    near = await createWorkshop({ ...p1, name: 'Near 1km', mechanics: [{ name: 'Andi', rating: 4.8, reviews: 10 }] });
    second = await createWorkshop({ ...p49, name: 'Edge 4.9km', mechanics: [{ name: 'Budi', rating: 4.0, reviews: 3 }, { name: 'Dedi' }] });
    outside = await createWorkshop({ ...p51, name: 'Outside 5.1km', mechanics: [{ name: 'Citra', rating: 5, reviews: 50 }] });
    await createWorkshop({ ...p1, name: 'Pending', status: 'PENDING' });
  });
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  it('ST_DWithin boundary: includes 4.9 km, excludes 5.1 km and unapproved workshops', async () => {
    const res = await request(app).post(`${API}/emergency/scan`).send({ latitude: ORIGIN.lat, longitude: ORIGIN.lng });
    expect(res.status).toBe(200);
    const names = res.body.data.workshops.map((w: { name: string }) => w.name);
    expect(names).toEqual(expect.arrayContaining(['Near 1km', 'Edge 4.9km']));
    expect(names).not.toContain('Outside 5.1km');
    expect(names).not.toContain('Pending');
    const edge = res.body.data.workshops.find((w: { name: string }) => w.name === 'Edge 4.9km');
    expect(edge.distance_meters).toBeGreaterThan(4890);
    expect(edge.distance_meters).toBeLessThan(5000);
  });

  it('uses the GIST spatial index for the radius scan', async () => {
    await pool.query('SET enable_seqscan = off');
    const { rows } = await pool.query(
      `EXPLAIN SELECT id FROM workshops WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 5000)`,
      [ORIGIN.lat, ORIGIN.lng],
    );
    await pool.query('RESET enable_seqscan');
    expect(rows.map((r) => r['QUERY PLAN']).join('\n')).toContain('idx_workshops_location_gist');
  });

  it('rolls back the whole emergency order when a sub-insert fails (no orphaned rows)', async () => {
    const guest = await createUser('GUEST');
    const before = { orders: await count('orders'), details: await count('emergency_details'), tx: await count('transactions') };
    const spy = jest.spyOn(emergencyRepository, 'insertDetails').mockRejectedValueOnce(new Error('simulated emergency_details failure'));
    const res = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await count('orders')).toBe(before.orders);
    expect(await count('emergency_details')).toBe(before.details);
    expect(await count('transactions')).toBe(before.tx);
  });

  it('creates an emergency order routed to the best workshop and blocks a second live request', async () => {
    const guest = await createUser('GUEST');
    const res = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.assigned_workshop.id).toBe(near.workshopId);

    const dup = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    expect(dup.status).toBe(409);
  });

  it('decline re-routes to the next workshop; accept dispatches a mechanic', async () => {
    const guest = await createUser('GUEST');
    const created = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    const orderId = created.body.data.id;

    // Another owner can't respond to this order (BOLA)
    const wrong = await request(app).patch(`${API}/emergency/${orderId}/respond`).set(second.owner.auth).send({ action: 'ACCEPT' });
    expect(wrong.status).toBe(404);

    const declined = await request(app).patch(`${API}/emergency/${orderId}/respond`).set(near.owner.auth).send({ action: 'DECLINE' });
    expect(declined.body.data.rerouted_to).toBe(second.workshopId);

    const accepted = await request(app)
      .patch(`${API}/emergency/${orderId}/respond`)
      .set(second.owner.auth)
      .send({ action: 'ACCEPT', estimated_price: 50000 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.mechanic.id).toBe(second.mechanicIds[0]);

    const detail = await request(app).get(`${API}/orders/${orderId}`).set(guest.auth);
    expect(detail.body.data).toMatchObject({ status: 'ACCEPTED', payment: { amount: 50000, status: 'UNPAID' } });
    // Another customer cannot see it
    const stranger = await createUser('CUSTOMER');
    expect((await request(app).get(`${API}/orders/${orderId}`).set(stranger.auth)).status).toBe(404);
  });

  it('re-routes after the response window expires, then UNASSIGNED when nobody is left', async () => {
    const guest = await createUser('GUEST');
    const created = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    const orderId = created.body.data.id;
    const firstWorkshop = created.body.data.assigned_workshop.id;

    const expire = () => pool.query(`UPDATE emergency_details SET response_deadline = NOW() - INTERVAL '1 second' WHERE order_id = $1`, [orderId]);
    await expire();
    await emergencyService.rerouteExpired();
    let { rows } = await pool.query('SELECT status, workshop_id FROM orders WHERE id = $1', [orderId]);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].workshop_id).not.toBe(firstWorkshop);

    await expire();
    await emergencyService.rerouteExpired();
    ({ rows } = await pool.query('SELECT status, workshop_id FROM orders WHERE id = $1', [orderId]));
    expect(rows[0]).toEqual({ status: 'UNASSIGNED', workshop_id: null });
    expect(outside.workshopId).toBeDefined(); // the 5.1 km workshop was never tried
  });
});
