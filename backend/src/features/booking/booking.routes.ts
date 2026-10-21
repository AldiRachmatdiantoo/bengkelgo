import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { bookingLimiter } from '../../common/middlewares/rateLimiter';
import { validate } from '../../common/middlewares/validate';
import { bookingController as c } from './booking.controller';
import { createBookingSchema } from './booking.schema';

const r = Router();

// Limiter after validation, so a malformed request doesn't use up one of the hourly attempts.
r.post('/', authenticate, authorize('CUSTOMER'), validate({ body: createBookingSchema }), bookingLimiter, c.create);

export default r;
