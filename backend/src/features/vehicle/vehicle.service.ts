import { z } from 'zod';
import { db, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
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

export interface VehicleRow {
  id: string;
  vehicle_type: string;
  brand: string;
  model: string | null;
  year: number | null;
  color: string | null;
  plate: string | null;
  created_at: string;
}
const COLS = 'id, vehicle_type, brand, model, year, color, plate, created_at';
const MAX_VEHICLES = 10;

export const vehicleService = {
  async list(userId: string) {
    const { rows } = await db.query<VehicleRow>(`SELECT ${COLS} FROM vehicles WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
    return rows;
  },

  async create(userId: string, v: VehicleInput) {
    const { rows: count } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM vehicles WHERE user_id = $1 AND deleted_at IS NULL`, [userId]);
    if (count[0].n >= MAX_VEHICLES) throw AppError.unprocessable(`At most ${MAX_VEHICLES} saved vehicles`, 'VEHICLE_LIMIT');
    const { rows } = await db.query<VehicleRow>(
      `INSERT INTO vehicles (user_id, vehicle_type, brand, model, year, color, plate) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS}`,
      [userId, v.vehicle_type, v.brand, v.model ?? null, v.year ?? null, v.color ?? null, v.plate ?? null],
    );
    return rows[0];
  },

  /** Partial update; scoped to the caller (BOLA). */
  async update(userId: string, id: string, v: UpdateVehicleInput) {
    const { rows } = await db.query<VehicleRow>(
      `UPDATE vehicles SET vehicle_type = COALESCE($3::vehicle_type, vehicle_type), brand = COALESCE($4, brand), model = COALESCE($5, model),
         year = COALESCE($6, year), color = COALESCE($7, color), plate = COALESCE($8, plate), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING ${COLS}`,
      [id, userId, v.vehicle_type ?? null, v.brand ?? null, v.model ?? null, v.year ?? null, v.color ?? null, v.plate ?? null],
    );
    if (!rows[0]) throw AppError.notFound('Vehicle not found');
    return rows[0];
  },

  /** Soft delete: orders that used the vehicle keep pointing at it. */
  async remove(userId: string, id: string) {
    const { rowCount } = await db.query(`UPDATE vehicles SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, userId]);
    if (!rowCount) throw AppError.notFound('Vehicle not found');
    return { id, deleted: true };
  },

  /** A saved vehicle the caller may attach to a new order; its type must match the order's. */
  async forOrder(q: Queryable, userId: string, vehicleId: string, orderVehicleType: string) {
    const { rows } = await q.query<VehicleRow>(`SELECT ${COLS} FROM vehicles WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [vehicleId, userId]);
    const v = rows[0];
    if (!v) throw AppError.notFound('Vehicle not found');
    if (v.vehicle_type !== orderVehicleType) {
      throw AppError.unprocessable(`This vehicle is a ${v.vehicle_type}, the order is for ${orderVehicleType}`, 'VEHICLE_TYPE_MISMATCH');
    }
    return v;
  },
};
