import { env } from '../../config/env';
import { db, withTransaction } from '../../common/db/transaction';
import { adminRepository } from './admin.repository';
import { AppError } from '../../common/errors/AppError';
import { audit } from '../../common/db/actor';
import { notificationService as notif } from '../notification/notification.service';

type Action = 'APPROVE' | 'REJECT' | 'SUSPEND';

/** Allowed admin transitions of workshops.status. */
const TRANSITIONS: Record<Action, { from: string[]; to: string }> = {
  APPROVE: { from: ['PENDING', 'REJECTED', 'SUSPENDED'], to: 'APPROVED' },
  REJECT: { from: ['PENDING'], to: 'REJECTED' },
  SUSPEND: { from: ['APPROVED'], to: 'SUSPENDED' },
};

export const adminService = {
  listWorkshops(q: { status?: string; page: number; limit: number }) {
    return adminRepository.listWorkshops(db, { status: q.status ?? null, limit: q.limit, offset: (q.page - 1) * q.limit });
  },

  /** PBI-405 */
  async setApproval(adminId: string, workshopId: string, input: { action: Action; reason?: string }) {
    const t = TRANSITIONS[input.action];
    if (input.action !== 'APPROVE' && !input.reason) throw AppError.badRequest('reason is required', 'REASON_REQUIRED');
    return withTransaction(async (tx) => {
      const current = await adminRepository.lockWorkshop(tx, workshopId);
      if (!current) throw AppError.notFound('Workshop not found');
      if (!t.from.includes(current.status)) {
        throw AppError.conflict(`Cannot ${input.action.toLowerCase()} a workshop that is ${current.status}`, 'INVALID_TRANSITION');
      }
      const updated = await adminRepository.setWorkshopStatus(tx, workshopId, t.to, input.reason ?? null);
      await audit(tx, { id: adminId, role: 'ADMIN' }, {
        action: `WORKSHOP_${input.action}`,
        entity: 'workshop',
        entityId: workshopId,
        details: { from: current.status, to: t.to, reason: input.reason ?? null },
      });
      const notice = {
        APPROVE: { type: 'WORKSHOP_APPROVED', title: 'Bengkel Anda disetujui dan sudah tampil ke pelanggan' },
        REJECT: { type: 'WORKSHOP_REJECTED', title: 'Pendaftaran bengkel ditolak' },
        SUSPEND: { type: 'WORKSHOP_SUSPENDED', title: 'Bengkel Anda dinonaktifkan admin' },
      }[input.action];
      await notif.notify(tx, [current.owner_id], { ...notice, body: input.reason ?? null, link: '/owner' });
      return { ...updated, reviewed_by: adminId };
    });
  },

  /** PBI-406: platform-wide financial summary for a date range (inclusive, business timezone). */
  async transactionReport(q: { from: string; to: string; workshop_id?: string }) {
    const r = await adminRepository.transactionReport(db, { from: q.from, to: q.to, workshopId: q.workshop_id ?? null }, env.CRON_TIMEZONE);
    return {
      period: { from: q.from, to: q.to },
      summary: r.summary,
      by_type: r.byType,
      by_status: r.byStatus,
      top_workshops: r.topWorkshops,
      daily: r.daily,
    };
  },
};
