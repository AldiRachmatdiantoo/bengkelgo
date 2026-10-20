import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../common/middlewares/auth';
import { emergencyLimiter } from '../../common/middlewares/rateLimiter';
import { validate } from '../../common/middlewares/validate';
import { emergencyController as c } from './emergency.controller';
import { emergencyRequestSchema, orderIdParam, priceSchema, respondSchema, scanSchema } from './emergency.schema';

const r = Router();

r.post('/scan', emergencyLimiter, optionalAuth, validate({ body: scanSchema }), c.scan);
r.post('/request', emergencyLimiter, authenticate, authorize('CUSTOMER', 'GUEST'), validate({ body: emergencyRequestSchema }), c.request);
r.patch('/:order_id/respond', authenticate, authorize('WORKSHOP_OWNER'), validate({ params: orderIdParam, body: respondSchema }), c.respond);
r.patch('/:order_id/price', authenticate, authorize('WORKSHOP_OWNER'), validate({ params: orderIdParam, body: priceSchema }), c.setPrice);

export default r;
