import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import type { RescheduleInput } from '../booking/booking.schema';
import { bookingService } from '../booking/booking.service';
import type { CancelInput, ListOrdersQuery, UpdateStatusInput } from './order.schema';
import { orderService } from './order.service';

type IdParams = { id: string };

export const orderController = {
  async listForCustomer(req: Request, res: Response) {
    ok(res, await orderService.listForCustomer(currentUser(req).id, input<unknown, ListOrdersQuery>(req).query));
  },

  async listForWorkshop(req: Request, res: Response) {
    ok(res, await orderService.listForWorkshop(currentUser(req).id, input<unknown, ListOrdersQuery>(req).query));
  },

  async detail(req: Request, res: Response) {
    ok(res, await orderService.detail(currentUser(req), input<unknown, unknown, IdParams>(req).params.id));
  },

  async updateStatus(req: Request, res: Response) {
    const { params, body } = input<UpdateStatusInput, unknown, IdParams>(req);
    ok(res, await orderService.updateStatus(currentUser(req).id, params.id, body));
  },

  async reschedule(req: Request, res: Response) {
    const { params, body } = input<RescheduleInput, unknown, IdParams>(req);
    ok(res, await bookingService.reschedule(currentUser(req).id, params.id, body, currentUser(req).role));
  },

  async history(req: Request, res: Response) {
    ok(res, await orderService.history(currentUser(req), input<unknown, unknown, IdParams>(req).params.id));
  },

  /** Body is optional ({ reason }), so older clients that send nothing keep working. */
  async cancel(req: Request, res: Response) {
    const { params, body } = input<CancelInput, unknown, IdParams>(req);
    ok(res, await orderService.cancelByCustomer(currentUser(req).id, params.id, body.reason, currentUser(req).role));
  },
};
