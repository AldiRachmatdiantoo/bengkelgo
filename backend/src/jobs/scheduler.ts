import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { emergencyService } from '../features/emergency/emergency.service';
import { deliverDue } from '../common/mail/outbox';
import { sendBookingReminders, sendSoonReminders } from './bookingReminder.job';

const tasks: ScheduledTask[] = [];

/** Prevents overlapping runs of the same job within this process. */
function guarded(name: string, fn: () => Promise<unknown>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error({ err, job: name }, 'Scheduled job failed');
    } finally {
      running = false;
    }
  };
}

export function startScheduler() {
  if (!env.ENABLE_CRON) return;

  // PBI-404: day-before reminders, checked hourly 08:00-20:00 WIB so bookings made after 08:00 for tomorrow still get one
  tasks.push(
    cron.schedule(
      env.REMINDER_CRON,
      guarded('booking-reminder', async () => {
        const r = await sendBookingReminders();
        logger.info(r, 'Booking reminders processed');
      }),
      { timezone: env.CRON_TIMEZONE },
    ),
  );

  // Second reminder ~2 hours before each booked slot (checked every 5 minutes)
  tasks.push(
    cron.schedule(
      '*/5 * * * *',
      guarded('booking-reminder-2h', async () => {
        const r = await sendSoonReminders();
        if (r.sent || r.failed) logger.info(r, '2-hour booking reminders processed');
      }),
      { timezone: env.CRON_TIMEZONE },
    ),
  );

  // Email outbox: retries emails whose first attempt failed (and purges old sent/failed rows), every minute
  tasks.push(
    cron.schedule(
      '* * * * *',
      guarded('email-outbox', async () => {
        const r = await deliverDue();
        if (r.sent || r.failed) logger.info(r, 'Queued emails processed');
      }),
    ),
  );

  // PBI-205: re-route emergencies whose 2-minute response window expired (checked every 15s)
  tasks.push(
    cron.schedule(
      '*/15 * * * * *',
      guarded('emergency-reroute', async () => {
        const n = await emergencyService.rerouteExpired();
        if (n > 0) logger.info({ count: n }, 'Expired emergency requests re-routed');
      }),
    ),
  );

  logger.info('Scheduler started');
}

/** For the admin health page: whether cron runs in this instance and when the reminder fires next. */
export function schedulerInfo() {
  const reminder = tasks[0];
  return {
    enabled: env.ENABLE_CRON,
    reminder_cron: env.REMINDER_CRON,
    timezone: env.CRON_TIMEZONE,
    next_reminder_run: reminder?.getNextRun()?.toISOString() ?? null,
  };
}

export function stopScheduler() {
  tasks.splice(0).forEach((t) => t.stop());
}
