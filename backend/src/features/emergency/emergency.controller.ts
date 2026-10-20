import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import type { EmergencyRequestInput, PriceInput, RespondInput, ScanInput } from './emergency.schema';
import { emergencyService } from './emergency.service';

type OrderParams = { order_id: string };

export const emergencyController = {
  async scan(req: Request, res: Response) {
    ok(res, await emergencyService.scan(input<ScanInput>(req).body));
  },

  async request(req: Request, res: Response) {
    created(res, await emergencyService.request(currentUser(req).id, input<EmergencyRequestInput>(req).body, currentUser(req).role));
  },

  async respond(req: Request, res: Response) {
    const { params, body } = input<RespondInput, unknown, OrderParams>(req);
    ok(res, await emergencyService.respond(currentUser(req).id, params.order_id, body));
  },

  async setPrice(req: Request, res: Response) {
    const { params, body } = input<PriceInput, unknown, OrderParams>(req);
    ok(res, await emergencyService.setPrice(currentUser(req).id, params.order_id, body));
  },
};
