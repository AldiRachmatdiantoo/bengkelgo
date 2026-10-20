import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { validate } from '../../common/middlewares/validate';
import { bookingController as c } from './booking.controller';
import { createBookingSchema } from './booking.schema';

const r = Router();

r.post('/', authenticate, authorize('CUSTOMER'), validate({ body: createBookingSchema }), c.create);

export default r;
