import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { sendStored } from '../../common/utils/storage';
import type { UploadProofInput, VerifyInput } from './payment.schema';
import { paymentService } from './payment.service';

type OrderParams = { order_id: string };

export const paymentController = {
  /** multipart/form-data: order_id (text) + proof (image file, already checked by imageUpload). */
  async uploadProof(req: Request, res: Response) {
    const { order_id, payer_reference, payer_name } = input<UploadProofInput>(req).body;
    ok(res, await paymentService.uploadProof(currentUser(req).id, order_id, req.file!, { payerReference: payer_reference, payerName: payer_name }, currentUser(req).role));
  },

  async get(req: Request, res: Response) {
    ok(res, await paymentService.get(currentUser(req), input<unknown, unknown, OrderParams>(req).params.order_id));
  },

  async qris(req: Request, res: Response) {
    const file = await paymentService.qrisFile(currentUser(req), input<unknown, unknown, OrderParams>(req).params.order_id);
    res.setHeader('Cache-Control', 'private, max-age=300');
    await sendStored(res, file);
  },

  async proof(req: Request, res: Response) {
    const file = await paymentService.proofFile(currentUser(req), input<unknown, unknown, OrderParams>(req).params.order_id);
    res.setHeader('Cache-Control', 'private, no-store');
    await sendStored(res, file);
  },

  async verify(req: Request, res: Response) {
    const { params, body } = input<VerifyInput, unknown, OrderParams>(req);
    ok(res, await paymentService.verify(currentUser(req).id, params.order_id, body));
  },
};
