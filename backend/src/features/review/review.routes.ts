import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { input, safeText, validate } from '../../common/middlewares/validate';
import { created } from '../../common/utils/http';
import { reviewService } from './review.service';

const r = Router();
const reviewSchema = z.object({
  order_id: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: safeText(1000).optional(),
});

r.post('/', authenticate, authorize('CUSTOMER', 'GUEST'), validate({ body: reviewSchema }), async (req: Request, res: Response) => {
  created(res, await reviewService.create(currentUser(req).id, input<z.infer<typeof reviewSchema>>(req).body));
});

export default r;
