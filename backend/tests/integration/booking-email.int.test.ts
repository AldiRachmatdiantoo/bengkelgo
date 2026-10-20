import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import * as mailer from '../../src/config/mailer';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { afterCommit, withTransaction } from '../../src/common/db/transaction';
import { RETRY_DELAYS_MS } from '../../src/features/booking/booking.email';
import { API, createUser, createWorkshop, describeDb, ORIGIN, resetDb, tomorrow } from './helpers';

const app = createApp();

/** Lets after-commit tasks (fired without awaiting) run. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describeDb('Booking emails (integration)', () => {
  let ws: Awaited<ReturnType<typeof createWorkshop>>;
  let send: jest.SpyInstance;

  beforeAll(async () => {
    await resetDb();
    ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, maxSlot: 1, mechanics: [{ name: 'M1' }] });
  });
  beforeEach(() => {
    memoryStore.reset();
    send = jest.spyOn(mailer, 'sendMail').mockResolvedValue();
  });
  afterEach(() => send.mockRestore());
  afterAll(() => pool.end());

  const book = (auth: Record<string, string>, slot: string) =>
    request(app).post(`${API}/booking`).set(auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: slot });
  const emailOf = async (userId: string) => (await pool.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId])).rows[0].email;

  it('emails a confirmation on booking, a waitlist notice when full, and a confirmation when promoted', async () => {
    const [a, b] = [await createUser('CUSTOMER', 'Ani Lestari'), await createUser('CUSTOMER', 'Budi Santoso')];

    const first = await book(a.auth, '11:00');
    expect(first.body.data.status).toBe('CONFIRMED');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: await emailOf(a.id), subject: expect.stringMatching(/^Booking terkonfirmasi: /) });
    expect(send.mock.calls[0][0].html).toContain(first.body.data.order_number);
    expect(send.mock.calls[0][0].html).toContain('Halo Ani,');

    const second = await book(b.auth, '11:00');
    expect(second.body.data.status).toBe('IN_QUEUE');
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ to: await emailOf(b.id), subject: expect.stringMatching(/^Booking masuk daftar tunggu: /) });
    expect(send.mock.calls[1][0].text).toContain('posisi 1');

    // A cancels: B is promoted and gets the good news
    await request(app).patch(`${API}/orders/${first.body.data.id}/cancel`).set(a.auth).send({ reason: 'Berhalangan' }).expect(200);
    await settle();
    const bEmail = await emailOf(b.id);
    expect(send.mock.calls.some((c) => c[0].to === bEmail && /^Kabar baik/.test(c[0].subject))).toBe(true);
  });

  it('emails the new schedule after a reschedule', async () => {
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, '13:00')).body.data;
    await settle();
    send.mockClear();
    await request(app).patch(`${API}/orders/${order.id}/reschedule`).set(c.auth).send({ booking_date: tomorrow(), time_slot: '14:00' }).expect(200);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toMatch(/^Jadwal booking diubah: .* pukul 14:00 WIB$/);
  });

  it('retries a failed send and stops once it goes through', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      send.mockRejectedValueOnce(Object.assign(new Error('getaddrinfo EAI_AGAIN smtp.gmail.com'), { code: 'EDNS' }));
      const c = await createUser('CUSTOMER');
      await book(c.auth, '16:00').expect(201);
      for (let i = 0; i < 20 && send.mock.calls.length < 1; i++) await Promise.resolve();
      expect(send).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
      expect(send).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1] + RETRY_DELAYS_MS[2]);
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('after-commit tasks never run when the transaction rolls back', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    await expect(
      withTransaction(async (tx) => {
        afterCommit(tx, task);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await withTransaction(async (tx) => afterCommit(tx, task));
    await settle();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
