import type { Queryable } from '../../common/db/transaction';
import { WORKSHOP_COLS } from '../workshop/workshop.repository';

export const adminRepository = {
  /** Workshops with their owner's contact, newest first, optionally of one status. */
  async listWorkshops(q: Queryable, f: { status: string | null; limit: number; offset: number }) {
    const { rows } = await q.query(
      `SELECT ${WORKSHOP_COLS}, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM workshops w JOIN users u ON u.id = w.owner_id
       WHERE ($1::workshop_status IS NULL OR w.status = $1)
       ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`,
      [f.status, f.limit, f.offset],
    );
    return rows;
  },

  async lockWorkshop(q: Queryable, workshopId: string) {
    const { rows } = await q.query<{ status: string; owner_id: string }>('SELECT status, owner_id FROM workshops WHERE id = $1 FOR UPDATE', [workshopId]);
    return rows[0] ?? null;
  },

  async setWorkshopStatus(q: Queryable, workshopId: string, status: string, reason: string | null) {
    const { rows } = await q.query(
      `UPDATE workshops SET status = $2::workshop_status, status_reason = $3,
         approved_at = CASE WHEN $2::workshop_status = 'APPROVED' THEN NOW() ELSE approved_at END, updated_at = NOW()
       WHERE id = $1 RETURNING id, name, status, status_reason, approved_at`,
      [workshopId, status, reason],
    );
    return rows[0];
  },

  /**
   * PBI-406 report for orders created between two business days (inclusive) in time zone `tz`,
   * optionally for one workshop.
   */
  async transactionReport(q: Queryable, f: { from: string; to: string; workshopId: string | null }, tz: string) {
    // Day boundaries are local business days (e.g. WIB), independent of the DB session timezone.
    const params = [f.from, f.to, f.workshopId, tz];
    const range = `o.created_at >= (($1::date)::timestamp AT TIME ZONE $4::text)
                   AND o.created_at < (($2::date + 1)::timestamp AT TIME ZONE $4::text)
                   AND ($3::uuid IS NULL OR o.workshop_id = $3)`;

    const [summary, byType, byStatus, topWorkshops, daily] = await Promise.all([
      q.query(
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
      q.query(
        `SELECT o.type, COUNT(*)::int AS orders, COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id WHERE ${range} GROUP BY o.type ORDER BY o.type`,
        params,
      ),
      q.query(`SELECT o.status, COUNT(*)::int AS orders FROM orders o WHERE ${range} GROUP BY o.status ORDER BY o.status`, params),
      q.query(
        `SELECT w.id, w.name, COUNT(*)::int AS orders, COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id JOIN workshops w ON w.id = o.workshop_id
         WHERE ${range} GROUP BY w.id, w.name ORDER BY verified_revenue DESC, orders DESC LIMIT 10`,
        params,
      ),
      q.query(
        `SELECT to_char(o.created_at AT TIME ZONE $4::text, 'YYYY-MM-DD') AS date, COUNT(*)::int AS orders,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'VERIFIED'), 0) AS verified_revenue
         FROM orders o JOIN transactions t ON t.order_id = o.id WHERE ${range}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
    ]);
    return { summary: summary.rows[0], byType: byType.rows, byStatus: byStatus.rows, topWorkshops: topWorkshops.rows, daily: daily.rows };
  },
};
