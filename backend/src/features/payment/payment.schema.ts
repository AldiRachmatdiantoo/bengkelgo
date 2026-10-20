import { z } from 'zod';
import { safeText } from '../../common/middlewares/validate';

export const verifySchema = z.object({ approve: z.boolean(), reason: safeText(500).optional() });
// multipart text fields; the payer's own references help the workshop match the transfer in its mutation list
export const uploadSchema = z.object({
  order_id: z.uuid(),
  payer_reference: safeText(64).pipe(z.string().min(3)).optional(),
  payer_name: safeText(100).pipe(z.string().min(2)).optional(),
});

export type VerifyInput = z.infer<typeof verifySchema>;
export type UploadProofInput = z.infer<typeof uploadSchema>;
