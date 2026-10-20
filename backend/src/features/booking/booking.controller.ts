import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created } from '../../common/utils/http';
import type { CreateBookingInput } from './booking.schema';
import { bookingService } from './booking.service';

export const bookingController = {
  async create(req: Request, res: Response) {
    created(res, await bookingService.create(currentUser(req).id, input<CreateBookingInput>(req).body, currentUser(req).role));
  },
};
