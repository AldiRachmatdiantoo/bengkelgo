import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { uuidParam, validate } from '../../common/middlewares/validate';
import { vehicleController as c } from './vehicle.controller';
import { updateVehicleSchema, vehicleSchema } from './vehicle.service';

const r = Router();
const idParam = { params: uuidParam('id') };

r.use(authenticate, authorize('CUSTOMER', 'GUEST'));

r.get('/', c.list);
r.post('/', validate({ body: vehicleSchema }), c.create);
r.patch('/:id', validate({ ...idParam, body: updateVehicleSchema }), c.update);
r.delete('/:id', validate(idParam), c.remove);

export default r;
