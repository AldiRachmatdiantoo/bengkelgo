import { z } from 'zod';
import { isoDate, latitude, longitude, pagination, phoneId, safeText, timeHHmm, vehicleType } from '../../common/middlewares/validate';

export const updateProfileSchema = z
  .object({
    name: safeText(150).pipe(z.string().min(3)).optional(),
    description: safeText(2000).optional(),
    address: safeText(500).pipe(z.string().min(5)).optional(),
    phone: phoneId.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    vehicle_types: z.array(vehicleType).min(1).max(2).optional(),
    open_time: timeHHmm.optional(),
    close_time: timeHHmm.optional(),
    max_slot_per_hour: z.coerce.number().int().min(1).max(100).optional(),
    is_open: z.boolean().optional(),
    accepts_emergency: z.boolean().optional(),
    /** 0 = Sunday ... 6 = Saturday; [] = open every day. */
    closed_weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    /** Daily break; send both, or both null to remove it. */
    break_start: timeHHmm.nullable().optional(),
    break_end: timeHHmm.nullable().optional(),
  })
  .refine((v) => (v.break_start === undefined) === (v.break_end === undefined) && (v.break_start === null) === (v.break_end === null), {
    message: 'break_start and break_end must be provided together',
    path: ['break_end'],
  })
  .refine((v) => !v.break_start || !v.break_end || v.break_start < v.break_end, {
    message: 'break_start must be before break_end',
    path: ['break_end'],
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'latitude and longitude must be provided together',
    path: ['longitude'],
  })
  .refine((v) => (v.open_time === undefined) === (v.close_time === undefined), {
    message: 'open_time and close_time must be provided together',
    path: ['close_time'],
  })
  .refine((v) => !v.open_time || !v.close_time || v.open_time < v.close_time, {
    message: 'open_time must be before close_time',
    path: ['close_time'],
  });

// Update schemas are built from the field definitions *without* defaults: Zod re-applies `.default()`
// inside `.partial()`, which used to reset omitted fields (duration -> 60, specializations -> []).
const serviceFields = {
  name: safeText(120).pipe(z.string().min(2)),
  description: safeText(1000).optional(),
  price: z.coerce.number().min(0).max(100_000_000),
  duration_minutes: z.coerce.number().int().min(5).max(1440),
  vehicle_type: vehicleType,
};
export const serviceSchema = z.object({ ...serviceFields, duration_minutes: serviceFields.duration_minutes.default(60) });
export const updateServiceSchema = z.object(serviceFields).partial().extend({ is_active: z.boolean().optional() });

const tag = safeText(40).pipe(z.string().min(2));
const mechanicFields = {
  name: safeText(100).pipe(z.string().min(2)),
  phone: phoneId.optional(),
  specializations: z.array(tag).max(10),
};
export const mechanicSchema = z.object({ ...mechanicFields, specializations: mechanicFields.specializations.default([]) });
export const updateMechanicSchema = z.object(mechanicFields).partial().extend({ is_active: z.boolean().optional() });

export const listWorkshopsQuery = pagination
  .extend({
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    radius_km: z.coerce.number().min(0.5).max(50).default(20),
    vehicle_type: vehicleType.optional(),
    search: safeText(100).optional(),
    /**
     * Omitted = previous behaviour (nearest first with a location, else best rated).
     * recommended = 0.6 * proximity + 0.4 * rating, the same weighting as SOS routing.
     */
    sort: z.enum(['distance', 'rating', 'recommended']).optional(),
    /** Item 17: with time_slot, only workshops that still have room in that slot. */
    date: isoDate.optional(),
    time_slot: z.string().regex(/^([01]\d|2[0-3]):00$/, 'time_slot must be HH:00').optional(),
  })
  .refine((v) => (v.date === undefined) === (v.time_slot === undefined), {
    message: 'date and time_slot must be provided together',
    path: ['time_slot'],
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'latitude and longitude must be provided together',
    path: ['longitude'],
  })
  .refine((v) => !(v.sort === 'distance' || v.sort === 'recommended') || v.latitude !== undefined, {
    message: 'sort=distance/recommended needs latitude and longitude',
    path: ['sort'],
  });

export const holidaySchema = z.object({ date: isoDate, note: safeText(150).optional() });
export const holidayQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export const nextSlotQuery = z.object({ from: isoDate.optional() });

export const replySchema = z.object({ reply: safeText(1000).pipe(z.string().min(2)) });
export const ownerStatsQuery = z.object({ date: isoDate.optional() });
export const photoParams = z.object({ id: z.uuid(), photoId: z.uuid() });
/** `size=sm`: the thumbnail (cards, gallery strip). */
export const photoQuery = z.object({ size: z.enum(['sm']).optional() });
export const mechanicPhotoParams = z.object({ id: z.uuid(), mechanicId: z.uuid() });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type MechanicInput = z.infer<typeof mechanicSchema>;
export type UpdateMechanicInput = z.infer<typeof updateMechanicSchema>;
export type ListWorkshopsQuery = z.infer<typeof listWorkshopsQuery>;
export type HolidayInput = z.infer<typeof holidaySchema>;
export type ReplyInput = z.infer<typeof replySchema>;
