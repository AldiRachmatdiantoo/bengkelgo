import { env } from '../../config/env';

/** Current local date (YYYY-MM-DD) and minutes-since-midnight in the business timezone (default Asia/Jakarta). */
export function localNow(now: Date = new Date(), timeZone = env.CRON_TIMEZONE): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hourly slots ("HH:00") between opening (inclusive) and closing (exclusive). */
export function hourlySlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const start = Math.ceil(toMinutes(openTime) / 60);
  const end = toMinutes(closeTime);
  for (let h = start; h * 60 + 60 <= end; h++) slots.push(`${String(h).padStart(2, '0')}:00`);
  return slots;
}

/** Calendar-valid date check (rejects 2026-02-30 etc.). */
export function isValidIsoDate(isoDate: string): boolean {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === isoDate;
}
