import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { API, createUser, createWorkshop, describeDb, ORIGIN, PNG, pointAt, resetDb, tomorrow } from './helpers';

/** Backlog "Paket A": small additive backend improvements (all optional for existing clients). */
const app = createApp();
const sos = { latitude: ORIGIN.lat, longitude: ORIGIN.lng, vehicle_type: 'MOTOR', problem_description: 'Aki soak tidak bisa starter' };

describeDb('Backlog paket A (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const book = (auth: Record<string, string>, ws: { workshopId: string; serviceId: string }, slot: string) =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: slot });

  it('1. partial PATCH keeps omitted fields (duration, skills)', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Patch Shop' });
    const svc = (await request(app).post(`${API}/workshops/services`).set(ws.owner.auth).send({ name: 'Tune up', price: 100000, duration_minutes: 90, vehicle_type: 'MOTOR' })).body.data;
    const patched = await request(app).patch(`${API}/workshops/services/${svc.id}`).set(ws.owner.auth).send({ price: 120000 });
    expect(patched.body.data).toMatchObject({ price: 120000, duration_minutes: 90 });

    const mech = (await request(app).post(`${API}/workshops/mechanics`).set(ws.owner.auth).send({ name: 'Joko', specializations: ['matic', 'injeksi'] })).body.data;
    const renamed = await request(app).patch(`${API}/workshops/mechanics/${mech.id}`).set(ws.owner.auth).send({ name: 'Joko S' });
    expect(renamed.body.data.specializations).toEqual(['matic', 'injeksi']);
    // Creating still applies the defaults.
    const plain = (await request(app).post(`${API}/workshops/services`).set(ws.owner.auth).send({ name: 'Cuci', price: 20000, vehicle_type: 'MOTOR' })).body.data;
    expect(plain.duration_minutes).toBe(60);
  });

  it('4. soft-deleted services disappear and cannot be booked, existing bookings stay', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Delete Shop' });
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '10:00')).body.data;
    const stranger = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Other Shop' });
    expect((await request(app).delete(`${API}/workshops/services/${ws.serviceId}`).set(stranger.owner.auth)).status).toBe(404); // BOLA

    await request(app).delete(`${API}/workshops/services/${ws.serviceId}`).set(ws.owner.auth).expect(200);
    expect((await request(app).delete(`${API}/workshops/services/${ws.serviceId}`).set(ws.owner.auth)).status).toBe(404);
    expect((await request(app).get(`${API}/workshops/services`).set(ws.owner.auth)).body.data).toEqual([]);
    expect((await request(app).get(`${API}/workshops/${ws.workshopId}`)).body.data.services).toEqual([]);
    expect((await request(app).patch(`${API}/workshops/services/${ws.serviceId}`).set(ws.owner.auth).send({ is_active: true })).status).toBe(404);
    const c2 = await createUser('CUSTOMER');
    expect((await book(c2.auth, ws, '11:00')).status).toBe(404);
    const detail = await request(app).get(`${API}/orders/${order.id}`).set(c.auth);
    expect(detail.body.data.booking.service_name).toBe('Servis Rutin');
  });

  it('5. owner replies to reviews of their own workshop only', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Review Shop' });
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '12:00')).body.data;
    await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    await request(app).patch(`${API}/orders/${order.id}/status`).set(ws.owner.auth).send({ status: 'COMPLETED' }).expect(200);
    const review = (await request(app).post(`${API}/reviews`).set(c.auth).send({ order_id: order.id, rating: 3, comment: 'Agak lama' })).body.data;

    const other = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Nosy Shop' });
    expect((await request(app).put(`${API}/workshops/reviews/${review.id}/reply`).set(other.owner.auth).send({ reply: 'Hmm' })).status).toBe(404);

    const reply = await request(app).put(`${API}/workshops/reviews/${review.id}/reply`).set(ws.owner.auth).send({ reply: 'Maaf, sedang <b>ramai</b>. Terima kasih masukannya!' });
    expect(reply.status).toBe(200);
    expect(reply.body.data.owner_reply).toBe('Maaf, sedang bramai/b. Terima kasih masukannya!');
    const pub = await request(app).get(`${API}/workshops/${ws.workshopId}/reviews`);
    expect(pub.body.data[0]).toMatchObject({ owner_reply: 'Maaf, sedang bramai/b. Terima kasih masukannya!' });
    expect(pub.body.data[0].replied_at).toBeTruthy();
    expect((await request(app).get(`${API}/workshops/me/reviews`).set(ws.owner.auth)).body.data).toHaveLength(1);

    await request(app).delete(`${API}/workshops/reviews/${review.id}/reply`).set(ws.owner.auth).expect(200);
    expect((await request(app).get(`${API}/workshops/${ws.workshopId}/reviews`)).body.data[0]).toMatchObject({ owner_reply: null, replied_at: null });
  });

  it('8. sort=distance | rating | recommended (default unchanged)', async () => {
    await pool.query(`UPDATE workshops SET status = 'SUSPENDED'`); // isolate from earlier tests
    const near = await createWorkshop({ ...(await pointAt(500, 0)), name: 'Dekat Biasa' });
    const far = await createWorkshop({ ...(await pointAt(4000, 90)), name: 'Jauh Bintang 5' });
    const mid = await createWorkshop({ ...(await pointAt(1500, 180)), name: 'Tengah Bagus' });
    await pool.query(`UPDATE workshops SET avg_rating = 2.0, total_reviews = 4 WHERE id = $1`, [near.workshopId]);
    await pool.query(`UPDATE workshops SET avg_rating = 5.0, total_reviews = 40 WHERE id = $1`, [far.workshopId]);
    await pool.query(`UPDATE workshops SET avg_rating = 4.8, total_reviews = 25 WHERE id = $1`, [mid.workshopId]);
    const names = async (q: Record<string, unknown>) =>
      ((await request(app).get(`${API}/workshops`).query(q)).body.data as { name: string }[]).map((w) => w.name);
    const at = { latitude: ORIGIN.lat, longitude: ORIGIN.lng };

    expect(await names(at)).toEqual(['Dekat Biasa', 'Tengah Bagus', 'Jauh Bintang 5']); // default with location = nearest
    expect(await names({})).toEqual(['Jauh Bintang 5', 'Tengah Bagus', 'Dekat Biasa']); // default without = best rated
    expect(await names({ ...at, sort: 'rating' })).toEqual(['Jauh Bintang 5', 'Tengah Bagus', 'Dekat Biasa']);
    // recommended: 0.6*(1-d/20km) + 0.4*rating/5 -> near 0.825, mid 0.939, far 0.88
    expect(await names({ ...at, sort: 'recommended' })).toEqual(['Tengah Bagus', 'Jauh Bintang 5', 'Dekat Biasa']);
    const bad = await request(app).get(`${API}/workshops`).query({ sort: 'distance' });
    expect(bad.status).toBe(400);
    expect((await request(app).get(`${API}/workshops`).query({ latitude: ORIGIN.lat })).status).toBe(400);
  });

  it('2, 3, 7. SOS price range, owner picks the mechanic, price edits until the customer pays', async () => {
    await pool.query(`UPDATE workshops SET status = 'SUSPENDED'`);
    const ws = await createWorkshop({ ...(await pointAt(700, 30)), name: 'SOS Shop', mechanics: [{ name: 'Auto Pick', rating: 5, reviews: 9 }, { name: 'Dipilih' }] });
    const [autoPick, chosen] = ws.mechanicIds;
    const guest = await createUser('GUEST');

    expect((await request(app).post(`${API}/emergency/request`).set(guest.auth).send({ ...sos, price_min: 300000, price_max: 100000 })).status).toBe(400);
    const em = (await request(app).post(`${API}/emergency/request`).set(guest.auth).send({ ...sos, price_min: 100000, price_max: 250000 })).body.data;
    const detail = await request(app).get(`${API}/orders/${em.id}`).set(guest.auth);
    expect(detail.body.data.emergency).toMatchObject({ price_min: 100000, price_max: 250000, problem_description: sos.problem_description });

    // Item 7: a mechanic of another workshop is "not found"; the chosen one is dispatched instead of the best-rated.
    const other = await createWorkshop({ lat: 0, lng: 0, name: 'Far Away' });
    expect((await request(app).patch(`${API}/emergency/${em.id}/respond`).set(ws.owner.auth).send({ action: 'ACCEPT', mechanic_id: other.mechanicIds[0] })).status).toBe(404);
    const accept = await request(app).patch(`${API}/emergency/${em.id}/respond`).set(ws.owner.auth).send({ action: 'ACCEPT', mechanic_id: chosen, estimated_price: 150000 });
    expect(accept.status).toBe(200);
    expect(accept.body.data.mechanic.id).toBe(chosen);
    expect(accept.body.data.mechanic.id).not.toBe(autoPick);

    // Item 3: revise the price while unpaid.
    const other2 = await createWorkshop({ lat: 0, lng: 0, name: 'Not Yours' });
    expect((await request(app).patch(`${API}/emergency/${em.id}/price`).set(other2.owner.auth).send({ estimated_price: 1 })).status).toBe(404);
    const price = await request(app).patch(`${API}/emergency/${em.id}/price`).set(ws.owner.auth).send({ estimated_price: 200000 });
    expect(price.status).toBe(200);
    expect((await request(app).get(`${API}/payments/${em.id}`).set(guest.auth)).body.data.amount).toBe(200000);

    // Once a proof is sent the price is locked.
    await request(app).post(`${API}/payments/upload`).set(guest.auth).field('order_id', em.id).attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(200);
    const locked = await request(app).patch(`${API}/emergency/${em.id}/price`).set(ws.owner.auth).send({ estimated_price: 999000 });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('PRICE_LOCKED');

    // A second SOS cannot take the busy chosen mechanic.
    const guest2 = await createUser('GUEST');
    const em2 = (await request(app).post(`${API}/emergency/request`).set(guest2.auth).send(sos)).body.data;
    const busy = await request(app).patch(`${API}/emergency/${em2.id}/respond`).set(ws.owner.auth).send({ action: 'ACCEPT', mechanic_id: chosen });
    expect(busy.status).toBe(409);
    expect(busy.body.error.code).toBe('MECHANIC_BUSY');
    // Without a range the SOS is "negotiable" (columns stay NULL).
    expect((await request(app).get(`${API}/orders/${em2.id}`).set(guest2.auth)).body.data.emergency).toMatchObject({ price_min: null, price_max: null });
  });

  it('6. cancellation reason and who cancelled; old clients without a body still work', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Cancel Shop' });
    const c = await createUser('CUSTOMER');
    const a = (await book(c.auth, ws, '15:00')).body.data;
    const b = (await book(c.auth, ws, '16:00')).body.data;
    const d = (await book(c.auth, ws, '17:00')).body.data;

    await request(app).patch(`${API}/orders/${a.id}/cancel`).set(c.auth).send({ reason: 'Ada urusan mendadak' }).expect(200);
    await request(app).patch(`${API}/orders/${b.id}/cancel`).set(c.auth).expect(200); // no body, like the current web app
    await request(app).patch(`${API}/orders/${d.id}/status`).set(ws.owner.auth).send({ status: 'CANCELLED', cancel_reason: 'Mekanik sakit' }).expect(200);

    const get = async (id: string) => (await request(app).get(`${API}/orders/${id}`).set(c.auth)).body.data;
    expect(await get(a.id)).toMatchObject({ status: 'CANCELLED', cancelled_by: 'CUSTOMER', cancel_reason: 'Ada urusan mendadak' });
    expect(await get(b.id)).toMatchObject({ status: 'CANCELLED', cancelled_by: 'CUSTOMER', cancel_reason: null });
    expect(await get(d.id)).toMatchObject({ status: 'CANCELLED', cancelled_by: 'WORKSHOP', cancel_reason: 'Mekanik sakit' });
  });

  it('9. payer reference on upload, invoice number issued once on verification', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Invoice Shop' });
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, ws, '18:00')).body.data;
    const upload = (fields: Record<string, string>) => {
      let r = request(app).post(`${API}/payments/upload`).set(c.auth).field('order_id', order.id);
      for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
      return r.attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' });
    };

    const up = await upload({ payer_reference: '123456789012', payer_name: 'Sinta Dewi' });
    expect(up.body.data).toMatchObject({ payer_reference: '123456789012', payer_name: 'Sinta Dewi', invoice_number: null });
    await request(app).patch(`${API}/payments/${order.id}/verify`).set(ws.owner.auth).send({ approve: false, reason: 'Nominal kurang' }).expect(200);
    expect((await request(app).get(`${API}/payments/${order.id}`).set(c.auth)).body.data.invoice_number).toBeNull();

    await upload({}).expect(200); // old clients send no payer fields: they are cleared, not kept from the rejected proof
    expect((await request(app).get(`${API}/payments/${order.id}`).set(ws.owner.auth)).body.data).toMatchObject({ payer_reference: null, payer_name: null });
    const ok = await request(app).patch(`${API}/payments/${order.id}/verify`).set(ws.owner.auth).send({ approve: true });
    expect(ok.body.data.invoice_number).toMatch(/^INV-\d{8}-\d{6}$/);
    const detail = await request(app).get(`${API}/orders/${order.id}`).set(c.auth);
    expect(detail.body.data.payment.invoice_number).toBe(ok.body.data.invoice_number);
  });
});
