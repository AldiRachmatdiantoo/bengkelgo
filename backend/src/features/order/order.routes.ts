import { Router, type Request, type Response } from 'express';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { input, uuidParam, validate } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { cancelSchema, listOrdersQuery, updateStatusSchema, type CancelInput, type ListOrdersQuery, type UpdateStatusInput } from './order.schema';
import { bookingService } from '../booking/booking.service';
import { rescheduleSchema, type RescheduleInput } from '../booking/booking.schema';
import { orderService } from './order.service';

const r = Router();
const idParam = { params: uuidParam('id') };

r.use(authenticate);

r.get('/me', authorize('CUSTOMER', 'GUEST'), validate({ query: listOrdersQuery }), async (req: Request, res: Response) => {
  ok(res, await orderService.listForCustomer(currentUser(req).id, input<unknown, ListOrdersQuery>(req).query));
});

r.get('/workshop', authorize('WORKSHOP_OWNER'), validate({ query: listOrdersQuery }), async (req: Request, res: Response) => {
  ok(res, await orderService.listForWorkshop(currentUser(req).id, input<unknown, ListOrdersQuery>(req).query));
});

r.get('/:id', validate(idParam), async (req: Request, res: Response) => {
  ok(res, await orderService.detail(currentUser(req), input<unknown, unknown, { id: string }>(req).params.id));
});

r.patch('/:id/status', authorize('WORKSHOP_OWNER'), validate({ ...idParam, body: updateStatusSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<UpdateStatusInput, unknown, { id: string }>(req);
  ok(res, await orderService.updateStatus(currentUser(req).id, params.id, body));
});

r.patch('/:id/reschedule', authorize('CUSTOMER', 'GUEST'), validate({ ...idParam, body: rescheduleSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<RescheduleInput, unknown, { id: string }>(req);
  ok(res, await bookingService.reschedule(currentUser(req).id, params.id, body, currentUser(req).role));
});

r.get('/:id/history', validate(idParam), async (req: Request, res: Response) => {
  ok(res, await orderService.history(currentUser(req), input<unknown, unknown, { id: string }>(req).params.id));
});

// Body is optional ({ reason }), so older clients that send nothing keep working.
r.patch('/:id/cancel', authorize('CUSTOMER', 'GUEST'), validate({ ...idParam, body: cancelSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<CancelInput, unknown, { id: string }>(req);
  ok(res, await orderService.cancelByCustomer(currentUser(req).id, params.id, body.reason, currentUser(req).role));
});

export default r;
