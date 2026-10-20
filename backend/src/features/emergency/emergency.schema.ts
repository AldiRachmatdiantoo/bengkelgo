import { z } from 'zod';
import { latitude, longitude, plate, safeText, uuidParam, vehicleType } from '../../common/middlewares/validate';

export const scanSchema = z.object({
  latitude,
  longitude,
  vehicle_type: vehicleType.optional(),
});

const money = z.coerce.number().min(0).max(100_000_000);
export const PROBLEM_CATEGORIES = ['BATTERY', 'TIRE', 'ENGINE', 'FUEL', 'TOWING', 'LOCKOUT', 'OTHER'] as const;

export const emergencyRequestSchema = z
  .object({
    latitude,
    longitude,
    vehicle_type: vehicleType,
    vehicle_plate: plate.optional(),
    problem_description: safeText(1000).pipe(z.string().min(5)),
    address_note: safeText(300).optional(),
    /** Customer's budget range; both optional ("negotiable" when omitted). */
    price_min: money.optional(),
    price_max: money.optional(),
    /** Saved vehicle of the requester (must match vehicle_type). */
    vehicle_id: z.uuid().optional(),
    problem_category: z.enum(PROBLEM_CATEGORIES).optional(),
  })
  .refine((v) => v.price_min === undefined || v.price_max === undefined || v.price_min <= v.price_max, {
    message: 'price_min must not be greater than price_max',
    path: ['price_max'],
  });

export const respondSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
  estimated_price: money.optional(),
  /** ACCEPT only: dispatch this mechanic instead of the automatic pick. */
  mechanic_id: z.uuid().optional(),
});

export const priceSchema = z.object({ estimated_price: money });

export const orderIdParam = uuidParam('order_id');

export type ScanInput = z.infer<typeof scanSchema>;
export type EmergencyRequestInput = z.infer<typeof emergencyRequestSchema>;
export type RespondInput = z.infer<typeof respondSchema>;
export type PriceInput = z.infer<typeof priceSchema>;
