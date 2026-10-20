import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { email, input, isoDate, pagination, password, phoneId, safeText, uuidParam, validate } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { addDays, localNow } from '../../common/utils/time';
import { adminService } from './admin.service';
import { statsService } from '../stats/stats.service';
import { usersService } from './users.service';

const r = Router();

const listQuery = pagination.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional() });
const approvalSchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'SUSPEND']), reason: safeText(500).optional() });
const reportQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional(), workshop_id: z.uuid().optional() })
  .transform((q) => {
    const today = localNow().date;
    return { ...q, from: q.from ?? addDays(today, -30), to: q.to ?? today };
  })
  .refine((q) => q.from <= q.to, { message: 'from must be on or before to', path: ['from'] });

r.use(authenticate, authorize('ADMIN'));

r.get('/workshops', validate({ query: listQuery }), async (req: Request, res: Response) => {
  ok(res, await adminService.listWorkshops(input<unknown, z.infer<typeof listQuery>>(req).query));
});

r.patch('/workshops/:id/approval', validate({ params: uuidParam('id'), body: approvalSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<z.infer<typeof approvalSchema>, unknown, { id: string }>(req);
  ok(res, await adminService.setApproval(currentUser(req).id, params.id, body));
});

r.get('/reports/transactions', validate({ query: reportQuery }), async (req: Request, res: Response) => {
  ok(res, await adminService.transactionReport(input<unknown, z.infer<typeof reportQuery>>(req).query));
});

r.get('/stats', async (_req: Request, res: Response) => {
  ok(res, await statsService.adminStats());
});

const searchQuery = z.object({ q: safeText(100).pipe(z.string().min(2)) });
r.get('/search', validate({ query: searchQuery }), async (req: Request, res: Response) => {
  ok(res, await statsService.search(input<unknown, z.infer<typeof searchQuery>>(req).query.q));
});

const auditQuery = pagination.extend({
  entity: z.enum(['order', 'workshop', 'service', 'user']).optional(),
  entity_id: z.uuid().optional(),
  actor_id: z.uuid().optional(),
  action: z.string().regex(/^[A-Z_]{3,60}$/).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
r.get('/audit-logs', validate({ query: auditQuery }), async (req: Request, res: Response) => {
  ok(res, await statsService.auditLogs(input<unknown, z.infer<typeof auditQuery>>(req).query));
});

r.get('/health', async (req: Request, res: Response) => {
  // client_ip: the address rate limits are keyed on; it must be the admin's own IP, not a proxy's (TRUST_PROXY).
  ok(res, { ...(await statsService.health()), client_ip: req.ip });
});

// ---------- BE-15: access management ----------
const usersQuery = pagination.extend({
  role: z.enum(['CUSTOMER', 'GUEST', 'WORKSHOP_OWNER', 'ADMIN']).optional(),
  q: safeText(100).optional(),
  active: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
});
r.get('/users', validate({ query: usersQuery }), async (req: Request, res: Response) => {
  ok(res, await usersService.list(input<unknown, z.infer<typeof usersQuery>>(req).query));
});

const activeSchema = z.object({ active: z.boolean(), reason: safeText(300).optional() });
r.patch('/users/:id/active', validate({ params: uuidParam('id'), body: activeSchema }), async (req: Request, res: Response) => {
  const { params, body } = input<z.infer<typeof activeSchema>, unknown, { id: string }>(req);
  ok(res, await usersService.setActive(currentUser(req).id, params.id, body.active, body.reason));
});

const adminSchema = z.object({ name: safeText(100).pipe(z.string().min(2)), email, phone: phoneId.optional(), password });
r.post('/users/admins', validate({ body: adminSchema }), async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await usersService.createAdmin(currentUser(req).id, input<z.infer<typeof adminSchema>>(req).body) });
});

export default r;
