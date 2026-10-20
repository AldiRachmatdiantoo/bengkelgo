import { Router, type Request, type Response } from 'express';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { input, validate } from '../../common/middlewares/validate';
import { created } from '../../common/utils/http';
import { createBookingSchema, type CreateBookingInput } from './booking.schema';
import { bookingService } from './booking.service';

const r = Router();

r.post('/', authenticate, authorize('CUSTOMER'), validate({ body: createBookingSchema }), async (req: Request, res: Response) => {
  created(res, await bookingService.create(currentUser(req).id, input<CreateBookingInput>(req).body, currentUser(req).role));
});

export default r;
