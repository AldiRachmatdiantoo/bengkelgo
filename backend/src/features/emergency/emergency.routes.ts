import { Router, type Request, type Response } from 'express';
import { authenticate, authorize, currentUser, optionalAuth } from '../../common/middlewares/auth';
import { emergencyLimiter } from '../../common/middlewares/rateLimiter';
import { input, validate } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import { emergencyRequestSchema, orderIdParam, priceSchema, respondSchema, scanSchema, type EmergencyRequestInput, type PriceInput, type RespondInput, type ScanInput } from './emergency.schema';
import { emergencyService } from './emergency.service';

const r = Router();

r.post('/scan', emergencyLimiter, optionalAuth, validate({ body: scanSchema }), async (req: Request, res: Response) => {
  ok(res, await emergencyService.scan(input<ScanInput>(req).body));
});

r.post(
  '/request',
  emergencyLimiter,
  authenticate,
  authorize('CUSTOMER', 'GUEST'),
  validate({ body: emergencyRequestSchema }),
  async (req: Request, res: Response) => {
    created(res, await emergencyService.request(currentUser(req).id, input<EmergencyRequestInput>(req).body, currentUser(req).role));
  },
);

r.patch(
  '/:order_id/respond',
  authenticate,
  authorize('WORKSHOP_OWNER'),
  validate({ params: orderIdParam, body: respondSchema }),
  async (req: Request, res: Response) => {
    const { params, body } = input<RespondInput, unknown, { order_id: string }>(req);
    ok(res, await emergencyService.respond(currentUser(req).id, params.order_id, body));
  },
);

r.patch(
  '/:order_id/price',
  authenticate,
  authorize('WORKSHOP_OWNER'),
  validate({ params: orderIdParam, body: priceSchema }),
  async (req: Request, res: Response) => {
    const { params, body } = input<PriceInput, unknown, { order_id: string }>(req);
    ok(res, await emergencyService.setPrice(currentUser(req).id, params.order_id, body));
  },
);

export default r;
