import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { imageUpload } from '../../common/middlewares/upload';
import { uuidParam, validate } from '../../common/middlewares/validate';
import { paymentController as c } from './payment.controller';
import { uploadSchema, verifySchema } from './payment.schema';

const r = Router();
const orderParam = { params: uuidParam('order_id') };

r.use(authenticate);

r.post('/upload', authorize('CUSTOMER', 'GUEST'), imageUpload('proof'), validate({ body: uploadSchema }), c.uploadProof);
r.get('/:order_id', validate(orderParam), c.get);
r.get('/:order_id/qris', validate(orderParam), c.qris);
r.get('/:order_id/proof', validate(orderParam), c.proof);
r.patch('/:order_id/verify', authorize('WORKSHOP_OWNER'), validate({ ...orderParam, body: verifySchema }), c.verify);

export default r;
