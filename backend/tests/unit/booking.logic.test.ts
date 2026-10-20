import { decideSlot, formatOrderNumber, promotableCount, validateSlot } from '../../src/features/booking/booking.logic';
import { canTransition } from '../../src/features/order/order.service';
import { hourlySlots, isValidIsoDate, localNow } from '../../src/common/utils/time';

describe('Queue number & slot decision (PBI-304)', () => {
  it('confirms and consumes quota while capacity remains', () => {
    expect(decideSlot({ currentBooked: 0, maxSlot: 3, lastQueueNumber: 0 })).toEqual({ status: 'CONFIRMED', queueNumber: 1, consumesQuota: true });
    expect(decideSlot({ currentBooked: 2, maxSlot: 3, lastQueueNumber: 7 })).toEqual({ status: 'CONFIRMED', queueNumber: 8, consumesQuota: true });
  });

  it('puts the booking IN_QUEUE without consuming quota when saturated', () => {
    expect(decideSlot({ currentBooked: 3, maxSlot: 3, lastQueueNumber: 3 })).toEqual({ status: 'IN_QUEUE', queueNumber: 4, consumesQuota: false });
    expect(decideSlot({ currentBooked: 0, maxSlot: 0, lastQueueNumber: 0 }).status).toBe('IN_QUEUE');
  });

  it('rejects corrupt quota state', () => {
    expect(() => decideSlot({ currentBooked: -1, maxSlot: 3, lastQueueNumber: 0 })).toThrow();
  });

  it('computes how many waitlisted bookings can be promoted', () => {
    expect(promotableCount(2, 3, 5)).toBe(1);
    expect(promotableCount(0, 5, 2)).toBe(2);
    expect(promotableCount(3, 3, 4)).toBe(0);
  });
});

describe('Slot validation', () => {
  const hours = { openTime: '08:00', closeTime: '17:00' };
  // 2026-06-10 09:30 WIB == 02:30 UTC
  const now = new Date('2026-06-10T02:30:00Z');

  it('accepts a future slot within operating hours', () => {
    expect(validateSlot('2026-06-11', '08:00', hours, now)).toBeNull();
    expect(validateSlot('2026-06-10', '10:00', hours, now)).toBeNull();
  });

  it('rejects started, past, far-future and out-of-hours slots', () => {
    expect(validateSlot('2026-06-10', '09:00', hours, now)).toBe('SLOT_ALREADY_STARTED');
    expect(validateSlot('2026-06-09', '10:00', hours, now)).toBe('DATE_IN_PAST');
    expect(validateSlot('2026-07-20', '10:00', hours, now)).toBe('DATE_TOO_FAR');
    expect(validateSlot('2026-06-11', '17:00', hours, now)).toBe('OUTSIDE_OPERATING_HOURS');
    expect(validateSlot('2026-06-11', '07:00', hours, now)).toBe('OUTSIDE_OPERATING_HOURS');
    expect(validateSlot('2026-06-11', '10:30', hours, now)).toBe('SLOT_NOT_ON_HOUR');
    expect(validateSlot('2026-02-30', '10:00', hours, now)).toBe('INVALID_DATE');
  });
});

describe('Time helpers', () => {
  it('builds hourly slots between open and close', () => {
    expect(hourlySlots('08:00', '12:00')).toEqual(['08:00', '09:00', '10:00', '11:00']);
    expect(hourlySlots('08:30', '11:00')).toEqual(['09:00', '10:00']);
  });

  it('resolves the Jakarta local date across the UTC day boundary', () => {
    expect(localNow(new Date('2026-06-10T18:00:00Z'), 'Asia/Jakarta')).toEqual({ date: '2026-06-11', minutes: 60 });
  });

  it('validates calendar dates', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2027-02-29')).toBe(false);
  });

  it('formats order numbers', () => {
    expect(formatOrderNumber('BK', 42, new Date('2026-06-10T02:30:00Z'))).toBe('BK-20260610-000042');
  });
});

describe('Order status transitions', () => {
  it('allows only valid owner transitions', () => {
    expect(canTransition('BOOKING', 'CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('BOOKING', 'IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('BOOKING', 'CONFIRMED', 'COMPLETED')).toBe(false);
    expect(canTransition('EMERGENCY', 'PENDING', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('EMERGENCY', 'COMPLETED', 'CANCELLED')).toBe(false);
  });
});
