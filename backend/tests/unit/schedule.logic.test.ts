import { overlapsBreak, validateSlot, weekdayOf } from '../../src/features/booking/booking.logic';

describe('Workshop schedule rules (item 16)', () => {
  const hours = { openTime: '08:00', closeTime: '17:00' };
  // Wednesday 2026-06-10, 07:00 WIB
  const now = new Date('2026-06-10T00:00:00Z');

  it('knows the weekday of a calendar date regardless of timezone', () => {
    expect(weekdayOf('2026-06-10')).toBe(3); // Wednesday
    expect(weekdayOf('2026-06-14')).toBe(0); // Sunday
  });

  it('blocks weekly closed days and holidays', () => {
    expect(validateSlot('2026-06-14', '10:00', hours, now, { closedWeekdays: [0] })).toBe('WORKSHOP_CLOSED_DAY');
    expect(validateSlot('2026-06-15', '10:00', hours, now, { closedWeekdays: [0] })).toBeNull();
    expect(validateSlot('2026-06-17', '10:00', hours, now, { holidays: ['2026-06-17'] })).toBe('WORKSHOP_CLOSED_DAY');
  });

  it('blocks hour slots that overlap the break', () => {
    expect(overlapsBreak('12:00', '12:00', '13:00')).toBe(true);
    expect(overlapsBreak('11:00', '11:30', '12:30')).toBe(true); // 11:00-12:00 overlaps 11:30-12:30
    expect(overlapsBreak('12:00', '11:30', '12:30')).toBe(true);
    expect(overlapsBreak('13:00', '12:00', '13:00')).toBe(false); // break ends exactly when the slot starts
    expect(overlapsBreak('11:00', '12:00', '13:00')).toBe(false);
    expect(overlapsBreak('11:00', null, null)).toBe(false);
    expect(validateSlot('2026-06-11', '12:00', hours, now, { breakStart: '12:00', breakEnd: '13:00' })).toBe('DURING_BREAK');
  });

  it('keeps the old rules when no schedule is given', () => {
    expect(validateSlot('2026-06-14', '10:00', hours, now)).toBeNull();
    expect(validateSlot('2026-06-14', '18:00', hours, now, { closedWeekdays: [0] })).toBe('OUTSIDE_OPERATING_HOURS');
  });
});
