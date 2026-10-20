import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { uuidParam, validate } from '../../common/middlewares/validate';
import { rescheduleSchema } from '../booking/booking.schema';
import { orderController as c } from './order.controller';
import { cancelSchema, listOrdersQuery, updateStatusSchema } from './order.schema';

const r = Router();
const idParam = { params: uuidParam('id') };

r.use(authenticate);

r.get('/me', authorize('CUSTOMER', 'GUEST'), validate({ query: listOrdersQuery }), c.listForCustomer);
r.get('/workshop', authorize('WORKSHOP_OWNER'), validate({ query: listOrdersQuery }), c.listForWorkshop);
r.get('/:id', validate(idParam), c.detail);
r.patch('/:id/status', authorize('WORKSHOP_OWNER'), validate({ ...idParam, body: updateStatusSchema }), c.updateStatus);
r.patch('/:id/reschedule', authorize('CUSTOMER', 'GUEST'), validate({ ...idParam, body: rescheduleSchema }), c.reschedule);
r.get('/:id/history', validate(idParam), c.history);
r.patch('/:id/cancel', authorize('CUSTOMER', 'GUEST'), validate({ ...idParam, body: cancelSchema }), c.cancel);

export default r;
