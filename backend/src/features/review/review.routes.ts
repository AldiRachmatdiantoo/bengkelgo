import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { validate } from '../../common/middlewares/validate';
import { reviewController as c } from './review.controller';
import { reviewSchema } from './review.schema';

const r = Router();

r.post('/', authenticate, authorize('CUSTOMER', 'GUEST'), validate({ body: reviewSchema }), c.create);

export default r;
