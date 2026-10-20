import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth';
import { validate } from '../../common/middlewares/validate';
import { notificationController as c } from './notification.controller';
import { listNotificationsQuery, markReadSchema } from './notification.schema';

const r = Router();

r.use(authenticate);

r.get('/', validate({ query: listNotificationsQuery }), c.list);
r.patch('/read', validate({ body: markReadSchema }), c.markRead);

export default r;
