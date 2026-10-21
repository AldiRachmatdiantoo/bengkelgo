import { env } from '../../config/env';
import type { Queryable } from '../../common/db/transaction';

export interface QuotaRow {
  id: string;
  current_booked: number;
  max_slot_per_hour: number;
}

export const bookingRepository = {
  /**
   * Serialises all booking mutations for one workshop-day (queue numbering + mechanic assignment).
   * Transaction-scoped: released automatically on COMMIT/ROLLBACK.
   */
  async lockWorkshopDay(q: Queryable, workshopId: string, date: string) {
    await q.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))`, [workshopId, date]);
  },

  /** Lazily materialises the quota row from the workshop default so it can be row-locked. */
  async ensureQuotaRow(q: Queryable, workshopId: string, date: string, slot: string) {
    await q.query(
      `INSERT INTO workshop_quotas (workshop_id, slot_date, slot_time, max_slot_per_hour)
       SELECT id, $2, $3, max_slot_per_hour FROM workshops WHERE id = $1
       ON CONFLICT (workshop_id, slot_date, slot_time) DO NOTHING`,
      [workshopId, date, slot],
    );
  },

  /** PRD 6.2: pessimistic lock on the quota row. Concurrent bookings for the same slot wait here. */
  async lockQuota(q: Queryable, workshopId: string, date: string, slot: string) {
    const { rows } = await q.query<QuotaRow>(
      `SELECT id, current_booked, max_slot_per_hour FROM workshop_quotas
       WHERE workshop_id = $1 AND slot_date = $2 AND slot_time = $3
       FOR UPDATE`,
      [workshopId, date, slot],
    );
    return rows[0] ?? null;
  },

  async adjustBooked(q: Queryable, quotaId: string, delta: number) {
    await q.query(`UPDATE workshop_quotas SET current_booked = current_booked + $2, updated_at = NOW() WHERE id = $1`, [quotaId, delta]);
  },

  async setQuotaMax(q: Queryable, quotaId: string, max: number) {
    await q.query(`UPDATE workshop_quotas SET max_slot_per_hour = $2, updated_at = NOW() WHERE id = $1`, [quotaId, max]);
  },

  async lastQueueNumber(q: Queryable, workshopId: string, date: string) {
    const { rows } = await q.query<{ last: number }>(
      `SELECT COALESCE(MAX(bd.queue_number), 0) AS last
       FROM booking_details bd JOIN orders o ON o.id = bd.order_id
       WHERE o.workshop_id = $1 AND bd.booking_date = $2`,
      [workshopId, date],
    );
    return rows[0].last;
  },

  async hasActiveBookingInSlot(q: Queryable, customerId: string, workshopId: string, date: string, slot: string) {
    const { rows } = await q.query(
      `SELECT 1 FROM booking_details bd JOIN orders o ON o.id = bd.order_id
       WHERE o.customer_id = $1 AND o.workshop_id = $2 AND bd.booking_date = $3 AND bd.time_slot = $4
         AND o.status IN ('CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS') LIMIT 1`,
      [customerId, workshopId, date, slot],
    );
    return rows.length > 0;
  },

  /** Serialises one customer's booking writes, so the active-booking limit can't be raced past. */
  async lockCustomer(q: Queryable, customerId: string) {
    await q.query(`SELECT pg_advisory_xact_lock(hashtextextended('booking-customer:' || $1::text, 0))`, [customerId]);
  },

  /** Unfinished bookings (confirmed, waitlisted or being serviced) of a customer, at any workshop. */
  async countActiveBookings(q: Queryable, customerId: string) {
    const { rows } = await q.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM orders
       WHERE customer_id = $1 AND type = 'BOOKING' AND status IN ('CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS')`,
      [customerId],
    );
    return rows[0].n;
  },

  /** True when the customer already has an unfinished booking at this workshop on this date (optionally ignoring one order). */
  async hasActiveBookingOnDay(q: Queryable, customerId: string, workshopId: string, date: string, exceptOrderId?: string) {
    const { rows } = await q.query(
      `SELECT 1 FROM booking_details bd JOIN orders o ON o.id = bd.order_id
       WHERE o.customer_id = $1 AND o.workshop_id = $2 AND bd.booking_date = $3
         AND o.status IN ('CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS') AND ($4::uuid IS NULL OR o.id <> $4::uuid) LIMIT 1`,
      [customerId, workshopId, date, exceptOrderId ?? null],
    );
    return rows.length > 0;
  },

  async insertDetails(q: Queryable, d: { orderId: string; serviceId: string; date: string; slot: string; queueNumber: number }) {
    await q.query(
      `INSERT INTO booking_details (order_id, service_id, booking_date, time_slot, queue_number) VALUES ($1, $2, $3, $4, $5)`,
      [d.orderId, d.serviceId, d.date, d.slot, d.queueNumber],
    );
  },

  async moveDetails(q: Queryable, orderId: string, date: string, slot: string, queueNumber: number) {
    await q.query(
      `UPDATE booking_details SET booking_date = $2, time_slot = $3, queue_number = $4, reminder_sent = FALSE, reminder_2h_sent = FALSE WHERE order_id = $1`,
      [orderId, date, slot, queueNumber],
    );
  },

  /** Materialised quota rows of a date range (missing rows = workshop default, nothing booked). */
  async usageRange(q: Queryable, workshopId: string, from: string, to: string) {
    const { rows } = await q.query<{ slot_date: string; slot_time: string; max_slot_per_hour: number; current_booked: number }>(
      `SELECT to_char(slot_date, 'YYYY-MM-DD') AS slot_date, to_char(slot_time, 'HH24:MI') AS slot_time, max_slot_per_hour, current_booked
       FROM workshop_quotas WHERE workshop_id = $1 AND slot_date BETWEEN $2 AND $3`,
      [workshopId, from, to],
    );
    return rows;
  },

  async findDetails(q: Queryable, orderId: string) {
    const { rows } = await q.query<{ booking_date: string; time_slot: string; queue_number: number; service_id: string }>(
      `SELECT booking_date, to_char(time_slot, 'HH24:MI') AS time_slot, queue_number, service_id FROM booking_details WHERE order_id = $1`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  /** Oldest waitlisted bookings of a slot (FIFO by queue number), locked for promotion. */
  async waitlistForUpdate(q: Queryable, workshopId: string, date: string, slot: string, limit: number) {
    const { rows } = await q.query<{ id: string }>(
      `SELECT o.id FROM orders o JOIN booking_details bd ON bd.order_id = o.id
       WHERE o.workshop_id = $1 AND bd.booking_date = $2 AND bd.time_slot = $3 AND o.status = 'IN_QUEUE'
       ORDER BY bd.queue_number ASC LIMIT $4
       FOR UPDATE OF o`,
      [workshopId, date, slot, limit],
    );
    return rows.map((r) => r.id);
  },

  async waitlistPosition(q: Queryable, workshopId: string, date: string, slot: string, queueNumber: number) {
    const { rows } = await q.query<{ pos: number }>(
      `SELECT COUNT(*)::int AS pos FROM orders o JOIN booking_details bd ON bd.order_id = o.id
       WHERE o.workshop_id = $1 AND bd.booking_date = $2 AND bd.time_slot = $3 AND o.status = 'IN_QUEUE' AND bd.queue_number <= $4`,
      [workshopId, date, slot, queueNumber],
    );
    return rows[0].pos;
  },

  /**
   * Mechanic Auto-Assignment (PBI-305): an active mechanic with no other booking in that slot and, for a
   * slot today, no active emergency job (an SOS dispatch lasts hours, not days, so it doesn't block
   * future dates). Prefers the lightest workload that day, then highest rating.
   */
  async pickMechanicForSlot(q: Queryable, workshopId: string, date: string, slot: string) {
    const { rows } = await q.query<{ id: string }>(
      `SELECT m.id FROM mechanics m
       WHERE m.workshop_id = $1 AND m.is_active
         AND NOT EXISTS (
           SELECT 1 FROM orders o JOIN booking_details bd ON bd.order_id = o.id
           WHERE o.mechanic_id = m.id AND bd.booking_date = $2 AND bd.time_slot = $3
             AND o.status IN ('CONFIRMED', 'IN_PROGRESS'))
         AND ($2::date <> (NOW() AT TIME ZONE $4::text)::date OR NOT EXISTS (
           SELECT 1 FROM orders eo
           WHERE eo.mechanic_id = m.id AND eo.type = 'EMERGENCY' AND eo.status IN ('ACCEPTED', 'IN_PROGRESS')))
       ORDER BY (
           SELECT COUNT(*) FROM orders o JOIN booking_details bd ON bd.order_id = o.id
           WHERE o.mechanic_id = m.id AND bd.booking_date = $2 AND o.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
         ) ASC, m.avg_rating DESC, m.id
       LIMIT 1`,
      [workshopId, date, slot, env.CRON_TIMEZONE],
    );
    return rows[0]?.id ?? null;
  },

  async slotUsage(q: Queryable, workshopId: string, date: string) {
    const { rows } = await q.query<{ slot_time: string; max_slot_per_hour: number; current_booked: number; waitlisted: number }>(
      `SELECT to_char(wq.slot_time, 'HH24:MI') AS slot_time, wq.max_slot_per_hour, wq.current_booked,
         (SELECT COUNT(*)::int FROM orders o JOIN booking_details bd ON bd.order_id = o.id
          WHERE o.workshop_id = wq.workshop_id AND bd.booking_date = wq.slot_date AND bd.time_slot = wq.slot_time
            AND o.status = 'IN_QUEUE') AS waitlisted
       FROM workshop_quotas wq WHERE wq.workshop_id = $1 AND wq.slot_date = $2`,
      [workshopId, date],
    );
    return rows;
  },
};
