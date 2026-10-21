import { db, withTransaction, type TxClient } from '../../common/db/transaction';
import { env } from '../../config/env';
import { setActor, type ActorRole } from '../../common/db/actor';
import { AppError } from '../../common/errors/AppError';
import { addDays, hourlySlots, localNow } from '../../common/utils/time';
import { notificationService as notif } from '../notification/notification.service';
import { orderRepository, type OrderRow } from '../order/order.repository';
import { vehicleService } from '../vehicle/vehicle.service';
import { holidayRepository, scheduleOf, serviceRepository, workshopRepository, type WorkshopRow } from '../workshop/workshop.repository';
import { MAX_BOOKING_DAYS_AHEAD, decideSlot, promotableCount, validateSlot } from './booking.logic';
import { authRepository } from '../auth/auth.repository';
import { bookingRepository } from './booking.repository';
import { emailBookingAfterCommit } from './booking.email';
import type { CreateBookingInput, RescheduleInput } from './booking.schema';

const SLOT_ERRORS: Record<string, string> = {
  INVALID_DATE: 'booking_date is not a valid calendar date',
  DATE_IN_PAST: 'booking_date is in the past',
  DATE_TOO_FAR: 'Bookings can only be made up to 30 days ahead',
  SLOT_NOT_ON_HOUR: 'time_slot must be on the hour (HH:00)',
  OUTSIDE_OPERATING_HOURS: 'time_slot is outside the workshop operating hours',
  WORKSHOP_CLOSED_DAY: 'The workshop is closed on this day',
  DURING_BREAK: 'time_slot falls in the workshop break',
  SLOT_ALREADY_STARTED: 'time_slot has already started',
};

/** Throws when (date, slot) can't be booked at this workshop (hours, closed days, holidays, break, past). */
async function assertBookable(w: WorkshopRow, date: string, slot: string) {
  const holidays = await holidayRepository.dates(db, w.id, date, date);
  const err = validateSlot(date, slot, { openTime: w.open_time, closeTime: w.close_time }, new Date(), scheduleOf(w, holidays));
  if (err) throw AppError.unprocessable(SLOT_ERRORS[err], err);
}

/** Promotes waitlisted bookings into freed capacity (caller must hold the day lock + quota row lock). */
async function promoteWaitlist(tx: TxClient, workshopId: string, date: string, slot: string, quota: { id: string; current_booked: number; max_slot_per_hour: number }) {
  const waitlisted = await bookingRepository.waitlistForUpdate(tx, workshopId, date, slot, 100);
  const n = promotableCount(quota.current_booked, quota.max_slot_per_hour, waitlisted.length);
  const promoted: string[] = [];
  for (const orderId of waitlisted.slice(0, n)) {
    const mechanicId = await bookingRepository.pickMechanicForSlot(tx, workshopId, date, slot);
    await orderRepository.setStatus(tx, orderId, 'CONFIRMED', { mechanicId });
    await notif.notifyOrder(tx, orderId, 'CUSTOMER', { type: 'BOOKING_PROMOTED', title: 'Naik dari daftar tunggu, booking terkonfirmasi', body: `${date} pukul ${slot}` });
    await emailBookingAfterCommit(tx, orderId, 'promoted');
    promoted.push(orderId);
  }
  if (n > 0) await bookingRepository.adjustBooked(tx, quota.id, n);
  return promoted;
}

/** Takes one unit of (date, slot) or joins its waitlist. Caller holds the day lock and the locked quota row. */
async function allocate(tx: TxClient, workshopId: string, date: string, slot: string, quota: { id: string; current_booked: number; max_slot_per_hour: number }) {
  const decision = decideSlot({
    currentBooked: quota.current_booked,
    maxSlot: quota.max_slot_per_hour,
    lastQueueNumber: await bookingRepository.lastQueueNumber(tx, workshopId, date),
  });
  const mechanicId = decision.consumesQuota ? await bookingRepository.pickMechanicForSlot(tx, workshopId, date, slot) : null;
  if (decision.consumesQuota) await bookingRepository.adjustBooked(tx, quota.id, 1);
  return { ...decision, mechanicId };
}

export const bookingService = {
  /**
   * PBI-303/304/305 — create a booking inside ONE transaction:
   *   customer lock + abuse guards -> advisory day lock -> SELECT quota FOR UPDATE -> INSERT orders + booking_details + transactions
   *   -> UPDATE quota (only when a slot unit is consumed) -> COMMIT.
   * Any failure rolls back every insert, so no orphaned order rows or leaked quota.
   */
  async create(customerId: string, input: CreateBookingInput, role: ActorRole = 'CUSTOMER') {
    // Fake sign-ups can't fill workshop slots or bounce booking emails: the address must be confirmed first.
    const customer = await authRepository.findUserById(db, customerId);
    if (!customer?.email_verified_at) throw AppError.forbidden('Verify your email address before booking', 'EMAIL_NOT_VERIFIED');
    const workshop = await workshopRepository.findById(db, input.workshop_id);
    if (!workshop || workshop.status !== 'APPROVED') throw AppError.notFound('Workshop not found');
    if (!workshop.is_open) throw AppError.unprocessable('Workshop is currently not accepting bookings', 'WORKSHOP_CLOSED');

    const service = await serviceRepository.findById(db, input.service_id);
    if (!service || service.workshop_id !== workshop.id || !service.is_active) throw AppError.notFound('Service not found for this workshop');

    await assertBookable(workshop, input.booking_date, input.time_slot);
    const vehicle = input.vehicle_id ? await vehicleService.forOrder(db, customerId, input.vehicle_id, service.vehicle_type) : null;

    return withTransaction(async (tx) => {
      await setActor(tx, { id: customerId, role });
      const { workshop_id: wid, booking_date: date, time_slot: slot } = input;
      // Customer lock first, then the day lock (same order everywhere a booking is created: no deadlocks).
      await bookingRepository.lockCustomer(tx, customerId);
      if (await bookingRepository.hasActiveBookingInSlot(tx, customerId, wid, date, slot)) {
        throw AppError.conflict('You already have a booking in this slot', 'DUPLICATE_BOOKING');
      }
      if (await bookingRepository.hasActiveBookingOnDay(tx, customerId, wid, date)) {
        throw AppError.conflict('You already have a booking at this workshop on this date', 'DAILY_WORKSHOP_LIMIT');
      }
      if ((await bookingRepository.countActiveBookings(tx, customerId)) >= env.BOOKING_MAX_ACTIVE) {
        throw AppError.conflict(`You can have at most ${env.BOOKING_MAX_ACTIVE} unfinished bookings`, 'ACTIVE_BOOKING_LIMIT');
      }
      await bookingRepository.lockWorkshopDay(tx, wid, date);
      await bookingRepository.ensureQuotaRow(tx, wid, date, slot);
      const quota = await bookingRepository.lockQuota(tx, wid, date, slot);
      if (!quota) throw AppError.notFound('Workshop not found');

      const decision = await allocate(tx, wid, date, slot, quota);
      const order = await orderRepository.insert(tx, {
        orderNumber: await orderRepository.nextOrderNumber(tx, 'BK'),
        type: 'BOOKING',
        status: decision.status,
        customerId,
        workshopId: wid,
        mechanicId: decision.mechanicId,
        vehicleType: service.vehicle_type,
        vehiclePlate: input.vehicle_plate ?? vehicle?.plate ?? undefined,
        vehicleId: vehicle?.id,
        notes: input.notes,
        totalAmount: service.price,
      });
      await bookingRepository.insertDetails(tx, { orderId: order.id, serviceId: service.id, date, slot, queueNumber: decision.queueNumber });
      await orderRepository.insertTransaction(tx, order.id, service.price);

      const waitlistPosition =
        decision.status === 'IN_QUEUE' ? await bookingRepository.waitlistPosition(tx, wid, date, slot, decision.queueNumber) : null;
      await notif.notifyOrder(tx, order.id, 'OWNER', {
        type: 'BOOKING_NEW',
        title: decision.status === 'IN_QUEUE' ? 'Booking baru dari {customer} (daftar tunggu)' : 'Booking baru dari {customer}',
        body: `${service.name} · ${date} pukul ${slot}`,
      });
      await emailBookingAfterCommit(tx, order.id, decision.status === 'IN_QUEUE' ? 'waitlist' : 'confirmed', { waitlistPosition });

      return {
        ...order,
        booking: { booking_date: date, time_slot: slot, queue_number: decision.queueNumber, waitlist_position: waitlistPosition },
        service: { id: service.id, name: service.name, price: service.price },
      };
    });
  },

  /**
   * Moves a CONFIRMED / IN_QUEUE booking to another slot of the same workshop in one transaction:
   * the old unit is released (promoting the waitlist there) and the new slot is taken, or joined as
   * waitlist when full. Day locks and quota rows are always taken in (date, slot) order so two
   * opposite reschedules can't deadlock.
   */
  async reschedule(customerId: string, orderId: string, input: RescheduleInput, role: ActorRole = 'CUSTOMER') {
    const current = await orderRepository.findById(db, orderId);
    if (!current || current.customer_id !== customerId || current.type !== 'BOOKING' || !current.workshop_id) throw AppError.notFound('Order not found');
    const workshop = (await workshopRepository.findById(db, current.workshop_id))!;
    if (workshop.status !== 'APPROVED' || !workshop.is_open) throw AppError.unprocessable('Workshop is currently not accepting bookings', 'WORKSHOP_CLOSED');
    await assertBookable(workshop, input.booking_date, input.time_slot);

    return withTransaction(async (tx) => {
      await setActor(tx, { id: customerId, role });
      const order = (await orderRepository.findByIdForUpdate(tx, orderId))!;
      if (!['CONFIRMED', 'IN_QUEUE'].includes(order.status)) {
        throw AppError.conflict(`Order cannot be rescheduled while ${order.status}`, 'INVALID_TRANSITION');
      }
      const old = (await bookingRepository.findDetails(tx, orderId))!;
      const next = { date: input.booking_date, slot: input.time_slot };
      if (old.booking_date === next.date && old.time_slot === next.slot) throw AppError.badRequest('That is already the booked slot', 'SAME_SLOT');
      const today = localNow();
      if (old.booking_date < today.date || (old.booking_date === today.date && Number(old.time_slot.slice(0, 2)) * 60 <= today.minutes)) {
        throw AppError.conflict('The booked slot has already started', 'TOO_LATE_TO_RESCHEDULE');
      }

      const wid = workshop.id;
      const slots = [{ date: old.booking_date, slot: old.time_slot }, next].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
      for (const d of [...new Set(slots.map((s) => s.date))]) await bookingRepository.lockWorkshopDay(tx, wid, d);
      for (const s of slots) await bookingRepository.ensureQuotaRow(tx, wid, s.date, s.slot);
      const quotas = new Map<string, NonNullable<Awaited<ReturnType<typeof bookingRepository.lockQuota>>>>();
      for (const s of slots) quotas.set(`${s.date} ${s.slot}`, (await bookingRepository.lockQuota(tx, wid, s.date, s.slot))!);

      if (await bookingRepository.hasActiveBookingInSlot(tx, customerId, wid, next.date, next.slot)) {
        throw AppError.conflict('You already have a booking in this slot', 'DUPLICATE_BOOKING');
      }
      if (next.date !== old.booking_date && (await bookingRepository.hasActiveBookingOnDay(tx, customerId, wid, next.date, orderId))) {
        throw AppError.conflict('You already have a booking at this workshop on this date', 'DAILY_WORKSHOP_LIMIT');
      }

      // Take the new slot first (so freeing the old one can't hand our own unit back to us), then release the old one.
      const decision = await allocate(tx, wid, next.date, next.slot, quotas.get(`${next.date} ${next.slot}`)!);
      await bookingRepository.moveDetails(tx, orderId, next.date, next.slot, decision.queueNumber);
      await orderRepository.setStatus(tx, orderId, decision.status, { mechanicId: decision.mechanicId });
      if (order.status === 'CONFIRMED') {
        const oldQuota = quotas.get(`${old.booking_date} ${old.time_slot}`)!;
        await bookingRepository.adjustBooked(tx, oldQuota.id, -1);
        await promoteWaitlist(tx, wid, old.booking_date, old.time_slot, { ...oldQuota, current_booked: oldQuota.current_booked - 1 });
      }

      await notif.notifyOrder(tx, orderId, 'OWNER', {
        type: 'BOOKING_RESCHEDULED',
        title: '{customer} mengganti jadwal booking',
        body: `${old.booking_date} ${old.time_slot} → ${next.date} ${next.slot}`,
      });
      const waitlistPosition =
        decision.status === 'IN_QUEUE' ? await bookingRepository.waitlistPosition(tx, wid, next.date, next.slot, decision.queueNumber) : null;
      await emailBookingAfterCommit(tx, orderId, decision.status === 'IN_QUEUE' ? 'waitlist' : 'rescheduled', { waitlistPosition });
      return {
        id: orderId,
        status: decision.status,
        previous: { booking_date: old.booking_date, time_slot: old.time_slot },
        booking: { booking_date: next.date, time_slot: next.slot, queue_number: decision.queueNumber, waitlist_position: waitlistPosition },
      };
    });
  },

  /**
   * Cancels a CONFIRMED/IN_QUEUE booking, releases its quota unit and promotes the next waitlisted booking.
   * Called from the order feature with the order row already locked FOR UPDATE.
   */
  async releaseBooking(tx: TxClient, order: OrderRow) {
    const details = await bookingRepository.findDetails(tx, order.id);
    if (!details || !order.workshop_id) return;
    await bookingRepository.lockWorkshopDay(tx, order.workshop_id, details.booking_date);
    const wasConfirmed = order.status === 'CONFIRMED';
    await orderRepository.setStatus(tx, order.id, 'CANCELLED', { mechanicId: null });
    if (!wasConfirmed) return;
    const quota = await bookingRepository.lockQuota(tx, order.workshop_id, details.booking_date, details.time_slot);
    if (!quota) return;
    await bookingRepository.adjustBooked(tx, quota.id, -1);
    await promoteWaitlist(tx, order.workshop_id, details.booking_date, details.time_slot, { ...quota, current_booked: quota.current_booked - 1 });
  },

  /** Owner override of a single slot's capacity; can never go below what is already booked. */
  async setSlotCapacity(ownerId: string, date: string, slot: string, max: number) {
    const workshop = await workshopRepository.findByOwner(db, ownerId);
    if (!workshop) throw AppError.notFound('Workshop not found');
    if (!hourlySlots(workshop.open_time, workshop.close_time).includes(slot)) {
      throw AppError.unprocessable(SLOT_ERRORS.OUTSIDE_OPERATING_HOURS, 'OUTSIDE_OPERATING_HOURS');
    }
    return withTransaction(async (tx) => {
      await setActor(tx, { id: ownerId, role: 'WORKSHOP_OWNER' });
      await bookingRepository.lockWorkshopDay(tx, workshop.id, date);
      await bookingRepository.ensureQuotaRow(tx, workshop.id, date, slot);
      const quota = (await bookingRepository.lockQuota(tx, workshop.id, date, slot))!;
      if (max < quota.current_booked) {
        throw AppError.unprocessable(`Capacity cannot be lower than the ${quota.current_booked} bookings already confirmed`, 'CAPACITY_BELOW_BOOKED');
      }
      await bookingRepository.setQuotaMax(tx, quota.id, max);
      const promoted = await promoteWaitlist(tx, workshop.id, date, slot, { ...quota, max_slot_per_hour: max });
      return { slot_date: date, slot_time: slot, max_slot_per_hour: max, current_booked: quota.current_booked + promoted.length, promoted_from_queue: promoted.length };
    });
  },

  /** Slot availability for a given date (public). `unavailable_reason` explains non-bookable slots. */
  async availability(workshopId: string, date: string) {
    const workshop = await workshopRepository.findById(db, workshopId);
    if (!workshop || workshop.status !== 'APPROVED') throw AppError.notFound('Workshop not found');
    const [usageRows, holidays] = await Promise.all([bookingRepository.slotUsage(db, workshopId, date), holidayRepository.dates(db, workshopId, date, date)]);
    const usage = new Map(usageRows.map((u) => [u.slot_time, u]));
    const schedule = scheduleOf(workshop, holidays);
    return hourlySlots(workshop.open_time, workshop.close_time).map((slot) => {
      const u = usage.get(slot);
      const max = u?.max_slot_per_hour ?? workshop.max_slot_per_hour;
      const booked = u?.current_booked ?? 0;
      const reason = validateSlot(date, slot, { openTime: workshop.open_time, closeTime: workshop.close_time }, new Date(), schedule);
      return {
        time_slot: slot,
        max_slot_per_hour: max,
        current_booked: booked,
        remaining: Math.max(0, max - booked),
        waitlisted: u?.waitlisted ?? 0,
        bookable: !reason,
        unavailable_reason: reason,
      };
    });
  },

  /**
   * Item 17: the earliest slot (today .. +30 days) that can be booked and still has capacity,
   * or null. Slots that are full but open for the waitlist are skipped.
   */
  async nextAvailableSlot(workshopId: string, from?: string) {
    const workshop = await workshopRepository.findById(db, workshopId);
    if (!workshop || workshop.status !== 'APPROVED') throw AppError.notFound('Workshop not found');
    if (!workshop.is_open) return null;
    const today = localNow().date;
    const start = from && from > today ? from : today;
    const end = addDays(today, MAX_BOOKING_DAYS_AHEAD);
    const [holidays, usage] = await Promise.all([
      holidayRepository.dates(db, workshopId, start, end),
      bookingRepository.usageRange(db, workshopId, start, end),
    ]);
    const schedule = scheduleOf(workshop, holidays);
    const used = new Map(usage.map((u) => [`${u.slot_date} ${u.slot_time}`, u]));
    for (let d = start; d <= end; d = addDays(d, 1)) {
      for (const slot of hourlySlots(workshop.open_time, workshop.close_time)) {
        if (validateSlot(d, slot, { openTime: workshop.open_time, closeTime: workshop.close_time }, new Date(), schedule)) continue;
        const u = used.get(`${d} ${slot}`);
        const remaining = (u?.max_slot_per_hour ?? workshop.max_slot_per_hour) - (u?.current_booked ?? 0);
        if (remaining > 0) return { booking_date: d, time_slot: slot, remaining };
      }
    }
    return null;
  },
};
