import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, currentUser } from '../../common/middlewares/auth';
import { input, pagination, validate } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { notificationService } from './notification.service';

const r = Router();
const listQuery = pagination.extend({ unread_only: z.enum(['true', 'false']).optional().transform((v) => v === 'true') });
const readSchema = z.object({ ids: z.array(z.uuid()).max(200).optional() });

r.use(authenticate);

/** Every role: the caller's own notifications, newest first, plus the unread count. */
r.get('/', validate({ query: listQuery }), async (req: Request, res: Response) => {
  ok(res, await notificationService.list(currentUser(req).id, input<unknown, z.infer<typeof listQuery>>(req).query));
});

/** { ids: [...] } marks those as read; an empty body marks all as read. */
r.patch('/read', validate({ body: readSchema }), async (req: Request, res: Response) => {
  ok(res, await notificationService.markRead(currentUser(req).id, input<z.infer<typeof readSchema>>(req).body.ids));
});

export default r;
