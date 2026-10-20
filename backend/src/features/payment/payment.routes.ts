import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { imageUpload } from '../../common/middlewares/upload';
import { input, safeText, uuidParam, validate } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { sendStored } from '../../common/utils/storage';
import { paymentService } from './payment.service';

const r = Router();
const orderParam = { params: uuidParam('order_id') };
const verifySchema = z.object({ approve: z.boolean(), reason: safeText(500).optional() });
// multipart text fields; the payer's own references help the workshop match the transfer in its mutation list
const uploadSchema = z.object({
  order_id: z.uuid(),
  payer_reference: safeText(64).pipe(z.string().min(3)).optional(),
  payer_name: safeText(100).pipe(z.string().min(2)).optional(),
});

r.use(authenticate);

// multipart/form-data: order_id (text) + proof (image file)
r.post(
  '/upload',
  authorize('CUSTOMER', 'GUEST'),
  imageUpload('proof'),
  validate({ body: uploadSchema }),
  async (req: Request, res: Response) => {
    const { order_id, payer_reference, payer_name } = input<z.infer<typeof uploadSchema>>(req).body;
    ok(res, await paymentService.uploadProof(currentUser(req).id, order_id, req.file!, { payerReference: payer_reference, payerName: payer_name }, currentUser(req).role));
  },
);

r.get('/:order_id', validate(orderParam), async (req: Request, res: Response) => {
  ok(res, await paymentService.get(currentUser(req), input<unknown, unknown, { order_id: string }>(req).params.order_id));
});

r.get('/:order_id/qris', validate(orderParam), async (req: Request, res: Response) => {
  const file = await paymentService.qrisFile(currentUser(req), input<unknown, unknown, { order_id: string }>(req).params.order_id);
  res.setHeader('Cache-Control', 'private, max-age=300');
  await sendStored(res, file);
});

r.get('/:order_id/proof', validate(orderParam), async (req: Request, res: Response) => {
  const file = await paymentService.proofFile(currentUser(req), input<unknown, unknown, { order_id: string }>(req).params.order_id);
  res.setHeader('Cache-Control', 'private, no-store');
  await sendStored(res, file);
});

r.patch('/:order_id/verify', authorize('WORKSHOP_OWNER'), validate({ ...orderParam, body: verifySchema }), async (req: Request, res: Response) => {
  const { params, body } = input<z.infer<typeof verifySchema>, unknown, { order_id: string }>(req);
  ok(res, await paymentService.verify(currentUser(req).id, params.order_id, body));
});

export default r;
