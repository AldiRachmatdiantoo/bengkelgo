import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { uuidParam, validate } from '../../common/middlewares/validate';
import { adminController as c } from './admin.controller';
import { activeSchema, adminSchema, approvalSchema, auditQuery, listWorkshopsAdminQuery, reportQuery, searchQuery, usersQuery } from './admin.schema';

const r = Router();
const idParam = { params: uuidParam('id') };

r.use(authenticate, authorize('ADMIN'));

r.get('/workshops', validate({ query: listWorkshopsAdminQuery }), c.listWorkshops);
r.patch('/workshops/:id/approval', validate({ ...idParam, body: approvalSchema }), c.setApproval);
r.get('/reports/transactions', validate({ query: reportQuery }), c.transactionReport);
r.get('/stats', c.stats);
r.get('/search', validate({ query: searchQuery }), c.search);
r.get('/audit-logs', validate({ query: auditQuery }), c.auditLogs);
r.get('/health', c.health);

// BE-15: access management
r.get('/users', validate({ query: usersQuery }), c.listUsers);
r.patch('/users/:id/active', validate({ ...idParam, body: activeSchema }), c.setUserActive);
r.post('/users/admins', validate({ body: adminSchema }), c.createAdmin);

export default r;
