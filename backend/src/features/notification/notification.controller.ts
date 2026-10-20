import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import type { ListNotificationsQuery, MarkReadInput } from './notification.schema';
import { notificationService } from './notification.service';

export const notificationController = {
  /** Every role: the caller's own notifications, newest first, plus the unread count. */
  async list(req: Request, res: Response) {
    ok(res, await notificationService.list(currentUser(req).id, input<unknown, ListNotificationsQuery>(req).query));
  },

  async markRead(req: Request, res: Response) {
    ok(res, await notificationService.markRead(currentUser(req).id, input<MarkReadInput>(req).body.ids));
  },
};
