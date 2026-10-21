import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import type { UpdateVehicleInput, VehicleInput } from './vehicle.schema';
import { vehicleService } from './vehicle.service';

type IdParams = { id: string };

/** Saved vehicles of customers and guests (`vehicle_id` can then be passed to bookings and SOS requests). */
export const vehicleController = {
  async list(req: Request, res: Response) {
    ok(res, await vehicleService.list(currentUser(req).id));
  },

  async create(req: Request, res: Response) {
    created(res, await vehicleService.create(currentUser(req).id, input<VehicleInput>(req).body));
  },

  async update(req: Request, res: Response) {
    const { params, body } = input<UpdateVehicleInput, unknown, IdParams>(req);
    ok(res, await vehicleService.update(currentUser(req).id, params.id, body));
  },

  async remove(req: Request, res: Response) {
    ok(res, await vehicleService.remove(currentUser(req).id, input<unknown, unknown, IdParams>(req).params.id));
  },
};
