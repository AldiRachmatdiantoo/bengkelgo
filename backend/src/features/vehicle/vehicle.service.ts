import { db, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { vehicleRepository } from './vehicle.repository';
import type { UpdateVehicleInput, VehicleInput } from './vehicle.schema';

const MAX_VEHICLES = 10;

export const vehicleService = {
  list(userId: string) {
    return vehicleRepository.list(db, userId);
  },

  async create(userId: string, v: VehicleInput) {
    if ((await vehicleRepository.count(db, userId)) >= MAX_VEHICLES) throw AppError.unprocessable(`At most ${MAX_VEHICLES} saved vehicles`, 'VEHICLE_LIMIT');
    return vehicleRepository.insert(db, userId, v);
  },

  /** Partial update; scoped to the caller (BOLA). */
  async update(userId: string, id: string, v: UpdateVehicleInput) {
    const row = await vehicleRepository.update(db, userId, id, v);
    if (!row) throw AppError.notFound('Vehicle not found');
    return row;
  },

  /** Soft delete: orders that used the vehicle keep pointing at it. */
  async remove(userId: string, id: string) {
    if (!(await vehicleRepository.softDelete(db, userId, id))) throw AppError.notFound('Vehicle not found');
    return { id, deleted: true };
  },

  /** A saved vehicle the caller may attach to a new order; its type must match the order's. */
  async forOrder(q: Queryable, userId: string, vehicleId: string, orderVehicleType: string) {
    const v = await vehicleRepository.findOwned(q, userId, vehicleId);
    if (!v) throw AppError.notFound('Vehicle not found');
    if (v.vehicle_type !== orderVehicleType) {
      throw AppError.unprocessable(`This vehicle is a ${v.vehicle_type}, the order is for ${orderVehicleType}`, 'VEHICLE_TYPE_MISMATCH');
    }
    return v;
  },
};
