import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import * as mailer from '../../src/config/mailer';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { afterCommit, withTransaction } from '../../src/common/db/transaction';
import { deliverDue, RETRY_DELAYS_SECONDS } from '../../src/common/mail/outbox';
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

  const outboxOf = async (orderId: string) =>
    (await pool.query<{ status: string; attempts: number; last_error: string | null }>(`SELECT status, attempts, last_error FROM email_outbox WHERE context->>'order_id' = $1`, [orderId])).rows;
  /** Pretends the retry delay has passed (the queue lives in the database, not in timers). */
  const makeDue = () => pool.query(`UPDATE email_outbox SET next_attempt_at = NOW() WHERE status = 'PENDING'`);

  it('a failed send stays queued in the database and goes out on the next attempt', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('getaddrinfo EAI_AGAIN smtp.gmail.com'), { code: 'EDNS' }));
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, '16:00').expect(201)).body.data;
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(await outboxOf(order.id)).toEqual([{ status: 'PENDING', attempts: 1, last_error: expect.stringContaining('EAI_AGAIN') }]);

    // Not due yet: the job leaves it alone (retry waits RETRY_DELAYS_SECONDS[0]).
    expect(await deliverDue()).toEqual({ sent: 0, failed: 0 });
    await makeDue();
    expect(await deliverDue()).toEqual({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await outboxOf(order.id)).toEqual([{ status: 'SENT', attempts: 2, last_error: null }]);
    expect(await deliverDue()).toEqual({ sent: 0, failed: 0 }); // never sent twice
  });

  it('gives up (FAILED) only after every retry failed', async () => {
    send.mockRejectedValue(new Error('550 mailbox unavailable'));
    const c = await createUser('CUSTOMER');
    const order = (await book(c.auth, '17:00').expect(201)).body.data;
    await settle();
    for (let i = 0; i < RETRY_DELAYS_SECONDS.length; i++) {
      await makeDue();
      await deliverDue();
    }
    expect(await outboxOf(order.id)).toEqual([{ status: 'FAILED', attempts: RETRY_DELAYS_SECONDS.length + 1, last_error: '550 mailbox unavailable' }]);
  });

  it('a refused booking leaves no queued email', async () => {
    const before = (await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM email_outbox')).rows[0].n;
    const c = await createUser('CUSTOMER');
    await request(app).post(`${API}/booking`).set(c.auth).send({ workshop_id: ws.workshopId, service_id: ws.serviceId, booking_date: tomorrow(), time_slot: '03:00' }).expect(422);
    expect((await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM email_outbox')).rows[0].n).toBe(before);
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
