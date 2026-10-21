import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import { statsService } from '../stats/stats.service';
import type { ActiveInput, ApprovalInput, AuditQuery, CreateAdminInput, ListWorkshopsAdminQuery, ReportQuery, SearchQuery, UsersQuery } from './admin.schema';
import { adminService } from './admin.service';
import { usersService } from './users.service';

type IdParams = { id: string };

export const adminController = {
  async listWorkshops(req: Request, res: Response) {
    ok(res, await adminService.listWorkshops(input<unknown, ListWorkshopsAdminQuery>(req).query));
  },

  async setApproval(req: Request, res: Response) {
    const { params, body } = input<ApprovalInput, unknown, IdParams>(req);
    ok(res, await adminService.setApproval(currentUser(req).id, params.id, body));
  },

  async transactionReport(req: Request, res: Response) {
    ok(res, await adminService.transactionReport(input<unknown, ReportQuery>(req).query));
  },

  async stats(_req: Request, res: Response) {
    ok(res, await statsService.adminStats());
  },

  async search(req: Request, res: Response) {
    ok(res, await statsService.search(input<unknown, SearchQuery>(req).query.q));
  },

  async auditLogs(req: Request, res: Response) {
    ok(res, await statsService.auditLogs(input<unknown, AuditQuery>(req).query));
  },

  async health(req: Request, res: Response) {
    // client_ip: the address rate limits are keyed on; it must be the admin's own IP, not a proxy's (TRUST_PROXY).
    // Proxy headers as received, so the admin can tell which hop holds their real IP when setting TRUST_PROXY.
    const h = (name: string) => (req.headers[name] as string | undefined) ?? null;
    const proxy_headers = {
      'x-forwarded-for': h('x-forwarded-for'),
      'x-real-ip': h('x-real-ip'),
      'cf-connecting-ip': h('cf-connecting-ip'),
      'true-client-ip': h('true-client-ip'),
      'x-vercel-forwarded-for': h('x-vercel-forwarded-for'),
      remote_address: req.socket.remoteAddress ?? null,
    };
    ok(res, { ...(await statsService.health()), client_ip: req.ip, proxy_headers });
  },

  // ---------- BE-15: access management ----------
  async listUsers(req: Request, res: Response) {
    ok(res, await usersService.list(input<unknown, UsersQuery>(req).query));
  },

  async setUserActive(req: Request, res: Response) {
    const { params, body } = input<ActiveInput, unknown, IdParams>(req);
    ok(res, await usersService.setActive(currentUser(req).id, params.id, body.active, body.reason));
  },

  async verifyUserEmail(req: Request, res: Response) {
    ok(res, await usersService.verifyEmail(currentUser(req).id, input<unknown, unknown, IdParams>(req).params.id));
  },

  async createAdmin(req: Request, res: Response) {
    created(res, await usersService.createAdmin(currentUser(req).id, input<CreateAdminInput>(req).body));
  },
};
