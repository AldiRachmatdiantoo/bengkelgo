import { env } from '../config/env';
import { withTransaction, type Queryable } from '../common/db/transaction';
import { deliverOne, queueEmail } from '../common/mail/outbox';
import { addDays, localNow } from '../common/utils/time';
import { BOOKING_EMAIL_COLUMNS, renderBookingEmail, type BookingEmailData } from '../features/booking/booking.email';

interface ReminderRow extends BookingEmailData {
  customer_id: string;
  customer_email: string;
}

/** In-app reminder; skipped when this kind was already sent for the order. */
async function notifyOnce(q: Queryable, r: ReminderRow, type: string, title: string, body: string) {
  await q.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT $1::uuid, $2::varchar, $3::varchar, $4::text, $5::varchar
     WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = $1::uuid AND type = $2::varchar AND link = $5::varchar)`,
    [r.customer_id, type, title, `${body} · ${r.order_number}`, `/orders/${r.order_id}`],
  );
}

/**
 * Claims due bookings, writes their in-app reminders and queues their emails in ONE transaction, then tries
 * to deliver the emails. A failed send stays in the email outbox and is retried there, so a reminder is never
 * lost (not even if the API stops mid-way) and never sent twice. `sent`/`failed` count this first attempt.
 */
async function remind(claimSql: string, params: unknown[], kind: 'tomorrow' | 'soon', notify: (q: Queryable, r: ReminderRow) => Promise<void>) {
  const queued = await withTransaction(async (tx) => {
    const { rows } = await tx.query<ReminderRow>(claimSql, params);
    const ids: string[] = [];
    for (const r of rows) {
      await notify(tx, r);
      // No email channel (e.g. guest accounts): the in-app reminder is enough.
      if (r.customer_email) ids.push(await queueEmail(tx, { to: r.customer_email, ...renderBookingEmail(kind, r) }, { order_id: r.order_id, kind }));
    }
    return { claimed: rows.length, ids };
  });
  let sent = 0;
  let failed = 0;
  for (const id of queued.ids) {
    const ok = await deliverOne(id);
    if (ok) sent++;
    else if (ok === false) failed++;
  }
  return { claimed: queued.claimed, sent, failed };
}

/**
 * FR-CRN-01 / PBI-404: reminds customers of bookings on CURRENT_DATE + 1 (business timezone, e.g. WIB).
 * Rows are claimed atomically (UPDATE ... reminder_sent = TRUE ... SKIP LOCKED) so several API
 * replicas running the cron never send duplicates.
 */
export async function sendBookingReminders(batchSize = 100): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  // "Tomorrow" in the business timezone, computed like booking-slot validation does (not the DB session date).
  const tomorrow = addDays(localNow().date, 1);
  for (;;) {
    const r = await remind(
      `WITH due AS (
         SELECT bd.order_id FROM booking_details bd JOIN orders o ON o.id = bd.order_id
         WHERE bd.booking_date = $2::date AND bd.reminder_sent = FALSE AND o.status = 'CONFIRMED'
         LIMIT $1 FOR UPDATE OF bd SKIP LOCKED),
       claimed AS (
         UPDATE booking_details bd SET reminder_sent = TRUE FROM due
         WHERE bd.order_id = due.order_id
         RETURNING bd.order_id, bd.booking_date, bd.time_slot, bd.queue_number, bd.service_id)
       SELECT ${BOOKING_EMAIL_COLUMNS}, o.customer_id
       FROM claimed c
       JOIN orders o ON o.id = c.order_id
       JOIN users u ON u.id = o.customer_id
       JOIN workshops w ON w.id = o.workshop_id
       JOIN services s ON s.id = c.service_id`,
      [batchSize, tomorrow],
      'tomorrow',
      (q, row) => notifyOnce(q, row, 'BOOKING_TOMORROW', `Besok pukul ${row.time_slot}: ${row.service_name}`, `${row.workshop_name} · antrean ${row.queue_number}`),
    );
    sent += r.sent;
    failed += r.failed;
    if (r.claimed < batchSize) break;
  }
  return { sent, failed };
}

/**
 * Second reminder about 2 hours before the slot (checked every 5 minutes): an in-app notification plus an
 * email. Same claim-and-queue pattern as above, so replicas never send twice.
 */
export async function sendSoonReminders(batchSize = 100): Promise<{ sent: number; failed: number }> {
  const r = await remind(
    `WITH due AS (
       SELECT bd.order_id FROM booking_details bd JOIN orders o ON o.id = bd.order_id
       WHERE bd.reminder_2h_sent = FALSE AND o.status = 'CONFIRMED'
         AND bd.booking_date BETWEEN (NOW() AT TIME ZONE $2::text)::date - 1 AND (NOW() AT TIME ZONE $2::text)::date + 1
         AND ((bd.booking_date + bd.time_slot) AT TIME ZONE $2::text) BETWEEN NOW() AND NOW() + interval '2 hours'
       LIMIT $1 FOR UPDATE OF bd SKIP LOCKED),
     claimed AS (
       UPDATE booking_details bd SET reminder_2h_sent = TRUE FROM due
       WHERE bd.order_id = due.order_id
       RETURNING bd.order_id, bd.booking_date, bd.time_slot, bd.queue_number, bd.service_id)
     SELECT ${BOOKING_EMAIL_COLUMNS}, o.customer_id
     FROM claimed c
     JOIN orders o ON o.id = c.order_id
     JOIN users u ON u.id = o.customer_id
     JOIN workshops w ON w.id = o.workshop_id
     JOIN services s ON s.id = c.service_id`,
    [batchSize, env.CRON_TIMEZONE],
    'soon',
    (q, row) => notifyOnce(q, row, 'BOOKING_SOON', `Servis Anda pukul ${row.time_slot} hari ini`, `${row.workshop_name}, ${row.workshop_address}`),
  );
  return { sent: r.sent, failed: r.failed };
}
