import { z } from 'zod';
import { isoDate, plate, safeText } from '../../common/middlewares/validate';

export const createBookingSchema = z.object({
  workshop_id: z.uuid(),
  service_id: z.uuid(),
  booking_date: isoDate,
  time_slot: z.string().regex(/^([01]\d|2[0-3]):00$/, 'time_slot must be HH:00'),
  vehicle_plate: plate.optional(),
  notes: safeText(500).optional(),
  /** Saved vehicle of the customer (must match the service's vehicle type). */
  vehicle_id: z.uuid().optional(),
});

export const rescheduleSchema = z.object({
  booking_date: isoDate,
  time_slot: z.string().regex(/^([01]\d|2[0-3]):00$/, 'time_slot must be HH:00'),
});

export const availabilityQuery = z.object({ date: isoDate });

export const slotCapacitySchema = z.object({
  date: isoDate,
  time_slot: z.string().regex(/^([01]\d|2[0-3]):00$/, 'time_slot must be HH:00'),
  max_slot_per_hour: z.coerce.number().int().min(0).max(100),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type SlotCapacityInput = z.infer<typeof slotCapacitySchema>;
