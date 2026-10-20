import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { localNow } from '../../src/common/utils/time';
import { bookingRepository } from '../../src/features/booking/booking.repository';
import { API, createUser, createWorkshop, describeDb, ORIGIN, PNG, pointAt, resetDb, tomorrow } from './helpers';

const app = createApp();

describeDb('Mechanic availability & refunds of cancelled paid orders (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const book = (auth: Record<string, string>, ws: { workshopId: string; serviceId: string }, slot: string) =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: slot });

  it('a mechanic busy on one kind of job is not handed the other (booking in progress <-> SOS)', async () => {
    const p = await pointAt(800, 45);
    const ws = await createWorkshop({ ...p, name: 'Solo Mechanic', mechanics: [{ name: 'Satu' }] });
    const [mechanicId] = ws.mechanicIds;
    const sos = { latitude: ORIGIN.lat, longitude: ORIGIN.lng, vehicle_type: 'MOTOR', problem_description: 'Mesin mati total' };

    // The only mechanic is working on a booking right now -> no SOS can be dispatched to this workshop.
    const c = await createUser('CUSTOMER');
    const booking = (await book(c.auth, ws, '09:00')).body.data;
    expect(booking.mechanic_id).toBe(mechanicId);
    await request(app).patch(`${API}/orders/${booking.id}/status`).set(ws.owner.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    const scan = await request(app).post(`${API}/emergency/scan`).send({ latitude: ORIGIN.lat, longitude: ORIGIN.lng });
    expect(scan.body.data.workshops.find((w: { id: string }) => w.id === ws.workshopId).available_mechanics).toBe(0);
    const guest = await createUser('GUEST');
    const blocked = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('NO_WORKSHOP_NEARBY');

    // Booking done -> the mechanic takes the SOS.
    await request(app).patch(`${API}/orders/${booking.id}/status`).set(ws.owner.auth).send({ status: 'COMPLETED' }).expect(200);
    const em = await request(app).post(`${API}/emergency/request`).set(guest.auth).send(sos);
    expect(em.status).toBe(201);
    const accept = await request(app).patch(`${API}/emergency/${em.body.data.id}/respond`).set(ws.owner.auth).send({ action: 'ACCEPT' });
    expect(accept.body.data.mechanic.id).toBe(mechanicId);

    // While on that SOS the mechanic is not auto-assigned to a booking slot today, but future days are fine.
    const today = localNow().date;
    expect(await bookingRepository.pickMechanicForSlot(pool, ws.workshopId, today, '20:00')).toBeNull();
    expect(await bookingRepository.pickMechanicForSlot(pool, ws.workshopId, tomorrow(), '11:00')).toBe(mechanicId);

    // SOS finished -> available today again.
    await request(app).patch(`${API}/orders/${em.body.data.id}/status`).set(ws.owner.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    await request(app).patch(`${API}/orders/${em.body.data.id}/status`).set(ws.owner.auth).send({ status: 'COMPLETED', final_amount: 50000 }).expect(200);
    expect(await bookingRepository.pickMechanicForSlot(pool, ws.workshopId, today, '20:00')).toBe(mechanicId);
  });

  it('cancelling a paid order requires a refund confirmation and moves the payment to REFUNDED', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Refund Shop', maxSlot: 2, price: 75000 });
    const admin = await createUser('ADMIN');
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '13:00')).body.data;
    const quota = async () =>
      (await pool.query<{ n: number }>(`SELECT current_booked AS n FROM workshop_quotas WHERE workshop_id = $1 AND slot_time = '13:00'`, [ws.workshopId])).rows[0].n;
    expect(await quota()).toBe(1);

    // Proof uploaded but not checked yet: nobody may cancel (the transfer would be left unaccounted for).
    await request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(200);
    const ownerEarly = await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'CANCELLED' });
    expect(ownerEarly.status).toBe(409);
    expect(ownerEarly.body.error.code).toBe('PAYMENT_PENDING_VERIFICATION');
    const customerEarly = await request(app).patch(`${API}/orders/${order.id}/cancel`).set(c.auth);
    expect(customerEarly.status).toBe(409);
    expect(customerEarly.body.error.code).toBe('PAYMENT_PENDING_VERIFICATION');

    await request(app).patch(`${API}/payments/${order.id}/verify`).set(ws.owner.auth).send({ approve: true }).expect(200);

    // Paid: the customer must ask the workshop; the workshop must confirm the refund.
    expect((await request(app).patch(`${API}/orders/${order.id}/cancel`).set(c.auth)).body.error.code).toBe('ORDER_ALREADY_PAID');
    const noConfirm = await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'CANCELLED' });
    expect(noConfirm.status).toBe(409);
    expect(noConfirm.body.error.code).toBe('REFUND_CONFIRMATION_REQUIRED');
    // ...and nothing changed (whole transaction rolled back).
    expect((await pool.query(`SELECT status FROM orders WHERE id = $1`, [order.id])).rows[0].status).toBe('CONFIRMED');
    expect(await quota()).toBe(1);

    const cancel = await request(app)
      .patch(`${API}/orders/${order.id}/status`)
      .set(ws.owner.auth)
      .send({ status: 'CANCELLED', refund_confirmed: true, refund_note: 'Transfer balik via QRIS <b>ok</b>' });
    expect(cancel.status).toBe(200);
    expect(await quota()).toBe(0);

    const pay = await request(app).get(`${API}/payments/${order.id}`).set(c.auth);
    expect(pay.body.data.status).toBe('REFUNDED');
    expect(pay.body.data.refund_note).toBe('Transfer balik via QRIS bok/b');
    expect(pay.body.data.refunded_at).toBeTruthy();
    const detail = await request(app).get(`${API}/orders/${order.id}`).set(c.auth);
    expect(detail.body.data.status).toBe('CANCELLED');
    expect(detail.body.data.payment.status).toBe('REFUNDED');

    // A refunded payment can't be paid or verified again.
    const reupload = await request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' });
    expect(reupload.body.error.code).toBe('ORDER_NOT_PAYABLE');

    // Reports: refunded money is no longer revenue.
    const report = await request(app).get(`${API}/admin/reports/transactions`).set(admin.auth).query({ workshop_id: ws.workshopId });
    expect(report.body.data.summary.verified_revenue).toBe(0);
    expect(report.body.data.summary.refunded_amount).toBe(75000);
    expect(report.body.data.summary.refunded_payments).toBe(1);
  });

  it('cancelling an unpaid order needs no refund confirmation', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Unpaid Shop' });
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '14:00')).body.data;
    await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'CANCELLED' }).expect(200);
    const pay = await request(app).get(`${API}/payments/${order.id}`).set(c.auth);
    expect(pay.body.data.status).toBe('UNPAID');
  });
});
