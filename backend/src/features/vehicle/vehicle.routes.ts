import { Router, type Request, type Response } from 'express';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { input, uuidParam, validate } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import { updateVehicleSchema, vehicleSchema, vehicleService, type UpdateVehicleInput, type VehicleInput } from './vehicle.service';

/** Saved vehicles of customers and guests (`vehicle_id` can then be passed to bookings and SOS requests). */
const r = Router();
const idParam = { params: uuidParam('id') };
r.use(authenticate, authorize('CUSTOMER', 'GUEST'));

r.get('/', async (req: Request, res: Response) => {
  ok(res, await vehicleService.list(currentUser(req).id));
});
r.post('/', validate({ body: vehicleSchema }), async (req: Request, res: Response) => {
  created(res, await vehicleService.create(currentUser(req).id, input<VehicleInput>(req).body));
});
r.patch('/:id', validate({ ...idParam, body: updateVehicleSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<UpdateVehicleInput, unknown, { id: string }>(req);
  ok(res, await vehicleService.update(currentUser(req).id, params.id, body));
});
r.delete('/:id', validate(idParam), async (req: Request, res: Response) => {
  ok(res, await vehicleService.remove(currentUser(req).id, input<unknown, unknown, { id: string }>(req).params.id));
});

export default r;
