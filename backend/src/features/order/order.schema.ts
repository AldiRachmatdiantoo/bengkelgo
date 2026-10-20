import { z } from 'zod';
import { isoDate, pagination, safeText } from '../../common/middlewares/validate';

export const listOrdersQuery = pagination.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_QUEUE', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'UNASSIGNED']).optional(),
  type: z.enum(['EMERGENCY', 'BOOKING']).optional(),
  date: isoDate.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  final_amount: z.coerce.number().min(0).max(100_000_000).optional(),
  /** Cancelling an order the customer already paid: the owner confirms the money was returned. */
  refund_confirmed: z.boolean().optional(),
  refund_note: safeText(300).optional(),
  /** Shown to the customer when status = CANCELLED. */
  cancel_reason: safeText(300).optional(),
});

export const cancelSchema = z.object({ reason: safeText(300).optional() });

export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
