/**
 * Runs the booking reminders once, now, instead of waiting for the cron (useful to test the email settings).
 *   npm run reminders:run              (local)
 *   docker compose exec api node dist/jobs/run-reminders.js   (Docker)
 * Sends the day-before reminder for tomorrow's bookings and the 2-hour reminder for slots starting soon.
 * Each booking is reminded only once, so running it twice sends nothing new.
 */
import { pool } from '../config/database';
import { describeMailTransport } from '../config/mailer';
import { sendBookingReminders, sendSoonReminders } from './bookingReminder.job';

async function main() {
  console.log(describeMailTransport());
  const tomorrow = await sendBookingReminders();
  const soon = await sendSoonReminders();
  console.log(`Day-before reminders: ${tomorrow.sent} sent, ${tomorrow.failed} failed`);
  console.log(`2-hour reminders: ${soon.sent} sent, ${soon.failed} failed`);
  if (tomorrow.failed || soon.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
