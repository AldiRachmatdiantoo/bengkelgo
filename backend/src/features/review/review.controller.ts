import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created } from '../../common/utils/http';
import type { ReviewInput } from './review.schema';
import { reviewService } from './review.service';

export const reviewController = {
  async create(req: Request, res: Response) {
    created(res, await reviewService.create(currentUser(req).id, input<ReviewInput>(req).body));
  },
};
