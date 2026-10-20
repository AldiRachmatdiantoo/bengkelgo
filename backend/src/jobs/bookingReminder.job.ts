import { sendMail } from '../config/mailer';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { db } from '../common/db/transaction';
import { addDays, localNow } from '../common/utils/time';
import { BOOKING_EMAIL_COLUMNS, renderBookingEmail, type BookingEmailData } from '../features/booking/booking.email';

interface ReminderRow extends BookingEmailData {
  customer_id: string;
  customer_email: string;
}

/** In-app reminder; skipped when this kind was already sent for the order (a failed email is retried, the notification isn't). */
async function notifyOnce(r: ReminderRow, type: string, title: string, body: string) {
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT $1::uuid, $2::varchar, $3::varchar, $4::text, $5::varchar
     WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = $1::uuid AND type = $2::varchar AND link = $5::varchar)`,
    [r.customer_id, type, title, `${body} · ${r.order_number}`, `/orders/${r.order_id}`],
  );
}

/**
 * FR-CRN-01 / PBI-404: reminds customers of bookings on CURRENT_DATE + 1 (business timezone, e.g. WIB).
 * Rows are claimed atomically (UPDATE ... reminder_sent = TRUE ... SKIP LOCKED) so several API
 * replicas running the cron never send duplicates; a failed send releases the claim for retry.
 */
export async function sendBookingReminders(batchSize = 100): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  // "Tomorrow" in the business timezone, computed like booking-slot validation does (not the DB session date).
  const tomorrow = addDays(localNow().date, 1);
  for (;;) {
    const { rows } = await db.query<ReminderRow>(
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
    );
    if (rows.length === 0) break;

    for (const r of rows) {
      await notifyOnce(r, 'BOOKING_TOMORROW', `Besok pukul ${r.time_slot}: ${r.service_name}`, `${r.workshop_name} · antrean ${r.queue_number}`);
      if (!r.customer_email) continue; // no email channel (e.g. phone-only account) — stays marked to avoid retry loops
      try {
        await sendMail({ to: r.customer_email, ...renderBookingEmail('tomorrow', r) });
        sent++;
      } catch (err) {
        failed++;
        logger.error({ err, orderId: r.order_id }, 'Failed to send booking reminder; releasing for retry');
        await db.query('UPDATE booking_details SET reminder_sent = FALSE WHERE order_id = $1', [r.order_id]);
      }
    }
    if (rows.length < batchSize || failed > 0) break;
  }
  return { sent, failed };
}

/**
 * Second reminder about 2 hours before the slot (checked every 5 minutes): an in-app notification plus an
 * email when SMTP is configured. Same claim-then-send pattern as above, so replicas never send twice.
 */
export async function sendSoonReminders(batchSize = 100): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const { rows } = await db.query<ReminderRow>(
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
  );
  for (const r of rows) {
    await notifyOnce(r, 'BOOKING_SOON', `Servis Anda pukul ${r.time_slot} hari ini`, `${r.workshop_name}, ${r.workshop_address}`);
    if (!r.customer_email) continue;
    try {
      await sendMail({ to: r.customer_email, ...renderBookingEmail('soon', r) });
      sent++;
    } catch (err) {
      failed++;
      logger.error({ err, orderId: r.order_id }, 'Failed to send 2-hour reminder; releasing for retry');
      await db.query('UPDATE booking_details SET reminder_2h_sent = FALSE WHERE order_id = $1', [r.order_id]);
    }
  }
  return { sent, failed };
}
