import { env } from '../../config/env';
import { db, withTransaction } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { WORKSHOP_COLS } from '../workshop/workshop.repository';
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
  async listWorkshops(q: { status?: string; page: number; limit: number }) {
    const { rows } = await db.query(
      `SELECT ${WORKSHOP_COLS}, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM workshops w JOIN users u ON u.id = w.owner_id
       WHERE ($1::workshop_status IS NULL OR w.status = $1)
       ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`,
      [q.status ?? null, q.limit, (q.page - 1) * q.limit],
    );
    return rows;
  },

  /** PBI-405 */
  async setApproval(adminId: string, workshopId: string, input: { action: Action; reason?: string }) {
    const t = TRANSITIONS[input.action];
    if (input.action !== 'APPROVE' && !input.reason) throw AppError.badRequest('reason is required', 'REASON_REQUIRED');
    return withTransaction(async (tx) => {
      const { rows } = await tx.query<{ status: string }>('SELECT status FROM workshops WHERE id = $1 FOR UPDATE', [workshopId]);
      if (!rows[0]) throw AppError.notFound('Workshop not found');
      if (!t.from.includes(rows[0].status)) {
        throw AppError.conflict(`Cannot ${input.action.toLowerCase()} a workshop that is ${rows[0].status}`, 'INVALID_TRANSITION');
      }
      const { rows: updated } = await tx.query(
        `UPDATE workshops SET status = $2::workshop_status, status_reason = $3,
           approved_at = CASE WHEN $2::workshop_status = 'APPROVED' THEN NOW() ELSE approved_at END, updated_at = NOW()
         WHERE id = $1 RETURNING id, name, status, status_reason, approved_at`,
        [workshopId, t.to, input.reason ?? null],
      );
      await audit(tx, { id: adminId, role: 'ADMIN' }, {
        action: `WORKSHOP_${input.action}`,
        entity: 'workshop',
        entityId: workshopId,
        details: { from: rows[0].status, to: t.to, reason: input.reason ?? null },
      });
      const { rows: owner } = await tx.query<{ owner_id: string }>('SELECT owner_id FROM workshops WHERE id = $1', [workshopId]);
      const notice = {
        APPROVE: { type: 'WORKSHOP_APPROVED', title: 'Bengkel Anda disetujui dan sudah tampil ke pelanggan' },
        REJECT: { type: 'WORKSHOP_REJECTED', title: 'Pendaftaran bengkel ditolak' },
        SUSPEND: { type: 'WORKSHOP_SUSPENDED', title: 'Bengkel Anda dinonaktifkan admin' },
      }[input.action];
      await notif.notify(tx, [owner[0].owner_id], { ...notice, body: input.reason ?? null, link: '/owner' });
      return { ...updated[0], reviewed_by: adminId };
    });
  },

  /** PBI-406: platform-wide financial summary for a date range (inclusive, business timezone). */
  async transactionReport(q: { from: string; to: string; workshop_id?: string }) {
    // Day boundaries are local business days (e.g. WIB), independent of the DB session timezone.
    const params = [q.from, q.to, q.workshop_id ?? null, env.CRON_TIMEZONE];
    const range = `o.created_at >= (($1::date)::timestamp AT TIME ZONE $4::text)
                   AND o.created_at < (($2::date + 1)::timestamp AT TIME ZONE $4::text)
                   AND ($3::uuid IS NULL OR o.workshop_id = $3)`;

    const [summary, byType, byStatus, topWorkshops, daily] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total_orders,
                COUNT(*) FILTER (WHERE o.status = 'COMPLETED')::int AS completed_orders,
                COUNT(*) FILTER (WHERE o.status = 'CANCELLED')::int AS cancelled_orders,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'PENDING_VERIFICATION'), 0) AS pending_verification_amount,
                COUNT(*) FILTER (WHERE t.status = 'VERIFIED')::int AS verified_payments,
                COUNT(*) FILTER (WHERE t.status = 'REJECTED')::int AS rejected_payments,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'REFUNDED'), 0) AS refunded_amount,
                COUNT(*) FILTER (WHERE t.status = 'REFUNDED')::int AS refunded_payments
         FROM orders o JOIN transactions t ON t.order_id = o.id WHERE ${range}`,
        params,
      ),
      db.query(
        `SELECT o.type, COUNT(*)::int AS orders, COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id WHERE ${range} GROUP BY o.type ORDER BY o.type`,
        params,
      ),
      db.query(`SELECT o.status, COUNT(*)::int AS orders FROM orders o WHERE ${range} GROUP BY o.status ORDER BY o.status`, params),
      db.query(
        `SELECT w.id, w.name, COUNT(*)::int AS orders, COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id JOIN workshops w ON w.id = o.workshop_id
         WHERE ${range} GROUP BY w.id, w.name ORDER BY verified_revenue DESC, orders DESC LIMIT 10`,
        params,
      ),
      db.query(
        `SELECT to_char(o.created_at AT TIME ZONE $4::text, 'YYYY-MM-DD') AS date, COUNT(*)::int AS orders,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id WHERE ${range}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
    ]);

    return {
      period: { from: q.from, to: q.to },
      summary: summary.rows[0],
      by_type: byType.rows,
      by_status: byStatus.rows,
      top_workshops: topWorkshops.rows,
      daily: daily.rows,
    };
  },
};
