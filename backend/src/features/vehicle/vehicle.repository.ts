import type { Queryable } from '../../common/db/transaction';
import type { UpdateVehicleInput, VehicleInput } from './vehicle.schema';

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

/** Saved vehicles; every query is scoped to the owning user (BOLA) and skips soft-deleted rows. */
export const vehicleRepository = {
  async list(q: Queryable, userId: string) {
    const { rows } = await q.query<VehicleRow>(`SELECT ${COLS} FROM vehicles WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
    return rows;
  },

  async count(q: Queryable, userId: string) {
    const { rows } = await q.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM vehicles WHERE user_id = $1 AND deleted_at IS NULL`, [userId]);
    return rows[0].n;
  },

  async insert(q: Queryable, userId: string, v: VehicleInput) {
    const { rows } = await q.query<VehicleRow>(
      `INSERT INTO vehicles (user_id, vehicle_type, brand, model, year, color, plate) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS}`,
      [userId, v.vehicle_type, v.brand, v.model ?? null, v.year ?? null, v.color ?? null, v.plate ?? null],
    );
    return rows[0];
  },

  /** Partial update (omitted fields keep their value); null when the vehicle isn't the user's. */
  async update(q: Queryable, userId: string, id: string, v: UpdateVehicleInput) {
    const { rows } = await q.query<VehicleRow>(
      `UPDATE vehicles SET vehicle_type = COALESCE($3::vehicle_type, vehicle_type), brand = COALESCE($4, brand), model = COALESCE($5, model),
         year = COALESCE($6, year), color = COALESCE($7, color), plate = COALESCE($8, plate), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING ${COLS}`,
      [id, userId, v.vehicle_type ?? null, v.brand ?? null, v.model ?? null, v.year ?? null, v.color ?? null, v.plate ?? null],
    );
    return rows[0] ?? null;
  },

  /** Soft delete: orders that used the vehicle keep pointing at it. Returns whether a row changed. */
  async softDelete(q: Queryable, userId: string, id: string) {
    const { rowCount } = await q.query(`UPDATE vehicles SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, userId]);
    return Boolean(rowCount);
  },

  async findOwned(q: Queryable, userId: string, id: string) {
    const { rows } = await q.query<VehicleRow>(`SELECT ${COLS} FROM vehicles WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, userId]);
    return rows[0] ?? null;
  },
};
