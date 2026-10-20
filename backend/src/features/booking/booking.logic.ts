/**
 * Pure booking rules (no I/O) so they can be unit-tested in isolation.
 */
import { addDays, hourlySlots, isValidIsoDate, localNow, toMinutes } from '../../common/utils/time';

export const MAX_BOOKING_DAYS_AHEAD = 30;

export interface SlotDecision {
  status: 'CONFIRMED' | 'IN_QUEUE';
  queueNumber: number;
  /** Whether workshop_quotas.current_booked must be incremented. */
  consumesQuota: boolean;
}

/**
 * Decides the outcome of a booking attempt given the locked quota row.
 * - Capacity left  -> CONFIRMED and consumes a quota unit.
 * - Slot saturated -> IN_QUEUE (waiting list), quota untouched so it can never be overbooked.
 * Queue numbers are sequential per workshop per day (the "nomor antrean" handed to the customer).
 */
export function decideSlot(params: { currentBooked: number; maxSlot: number; lastQueueNumber: number }): SlotDecision {
  const { currentBooked, maxSlot, lastQueueNumber } = params;
  if (currentBooked < 0 || maxSlot < 0 || lastQueueNumber < 0) throw new Error('Invalid quota state');
  const hasCapacity = currentBooked < maxSlot;
  return {
    status: hasCapacity ? 'CONFIRMED' : 'IN_QUEUE',
    queueNumber: lastQueueNumber + 1,
    consumesQuota: hasCapacity,
  };
}

/** How many waitlisted bookings can be promoted after capacity changes. */
export function promotableCount(currentBooked: number, maxSlot: number, waitlisted: number): number {
  return Math.max(0, Math.min(waitlisted, maxSlot - currentBooked));
}

export type SlotValidationError =
  | 'INVALID_DATE'
  | 'DATE_IN_PAST'
  | 'DATE_TOO_FAR'
  | 'SLOT_NOT_ON_HOUR'
  | 'OUTSIDE_OPERATING_HOURS'
  | 'WORKSHOP_CLOSED_DAY'
  | 'DURING_BREAK'
  | 'SLOT_ALREADY_STARTED';

/** Weekly closed days (0 = Sunday ... 6 = Saturday), daily break and one-off holidays (YYYY-MM-DD). */
export interface WorkshopSchedule {
  closedWeekdays?: number[];
  breakStart?: string | null;
  breakEnd?: string | null;
  holidays?: string[];
}

/** Day of week of a calendar date (independent of any timezone). */
export const weekdayOf = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

/** Whether the hour slot [slot, slot + 60 min) overlaps the break [breakStart, breakEnd). */
export function overlapsBreak(timeSlot: string, breakStart?: string | null, breakEnd?: string | null): boolean {
  if (!breakStart || !breakEnd) return false;
  const start = toMinutes(timeSlot);
  return start < toMinutes(breakEnd) && start + 60 > toMinutes(breakStart);
}

/** Validates a requested (date, HH:00) slot against operating hours, the workshop schedule and the current local time. */
export function validateSlot(
  bookingDate: string,
  timeSlot: string,
  hours: { openTime: string; closeTime: string },
  now: Date = new Date(),
  schedule: WorkshopSchedule = {},
): SlotValidationError | null {
  if (!isValidIsoDate(bookingDate)) return 'INVALID_DATE';
  if (!/^\d{2}:00$/.test(timeSlot)) return 'SLOT_NOT_ON_HOUR';
  const today = localNow(now);
  if (bookingDate < today.date) return 'DATE_IN_PAST';
  if (bookingDate > addDays(today.date, MAX_BOOKING_DAYS_AHEAD)) return 'DATE_TOO_FAR';
  if (!hourlySlots(hours.openTime, hours.closeTime).includes(timeSlot)) return 'OUTSIDE_OPERATING_HOURS';
  if (schedule.closedWeekdays?.includes(weekdayOf(bookingDate)) || schedule.holidays?.includes(bookingDate)) return 'WORKSHOP_CLOSED_DAY';
  if (overlapsBreak(timeSlot, schedule.breakStart, schedule.breakEnd)) return 'DURING_BREAK';
  if (bookingDate === today.date && toMinutes(timeSlot) <= today.minutes) return 'SLOT_ALREADY_STARTED';
  return null;
}

export function formatOrderNumber(prefix: 'BK' | 'EM', seq: number, now: Date = new Date()): string {
  const d = localNow(now).date.replace(/-/g, '');
  return `${prefix}-${d}-${String(seq).padStart(6, '0')}`;
}
