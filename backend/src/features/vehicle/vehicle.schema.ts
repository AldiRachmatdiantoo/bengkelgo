import { z } from 'zod';
import { plate, safeText, vehicleType } from '../../common/middlewares/validate';

export const vehicleSchema = z.object({
  vehicle_type: vehicleType,
  brand: safeText(50).pipe(z.string().min(2)),
  model: safeText(50).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  color: safeText(30).optional(),
  plate: plate.optional(),
});
export const updateVehicleSchema = vehicleSchema.partial();
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
