import { z } from 'zod';
import { safeText } from '../../common/middlewares/validate';

export const reviewSchema = z.object({
  order_id: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: safeText(1000).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
