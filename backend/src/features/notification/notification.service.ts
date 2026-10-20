import { db, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';

export interface NewNotification {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

const rupiah = (n: number) => `Rp${Math.round(Number(n)).toLocaleString('id-ID')}`;

/** Who is on each side of an order (customer + owner of the assigned workshop, if any). */
async function orderParties(q: Queryable, orderId: string) {
  const { rows } = await q.query<{ customer_id: string; customer_name: string; owner_id: string | null; order_number: string; type: string }>(
    `SELECT o.customer_id, c.name AS customer_name, w.owner_id, o.order_number, o.type
     FROM orders o JOIN users c ON c.id = o.customer_id LEFT JOIN workshops w ON w.id = o.workshop_id WHERE o.id = $1`,
    [orderId],
  );
  return rows[0] ?? null;
}

export const notificationService = {
  rupiah,

  /** Inserted inside the caller's transaction, so a rolled-back action never leaves a notification behind. */
  async notify(q: Queryable, userIds: (string | null | undefined)[], n: NewNotification) {
    const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
    if (!ids.length) return;
    await q.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT u, $2, $3, $4, $5 FROM unnest($1::uuid[]) AS u`,
      [ids, n.type, n.title, n.body ?? null, n.link ?? null],
    );
  },

  /**
   * Notifies one side of an order; the order number is appended to the body and the link points at the order.
   * `{customer}` in the title is replaced by the customer's name (useful on the workshop side).
   */
  async notifyOrder(q: Queryable, orderId: string, to: 'CUSTOMER' | 'OWNER', n: Omit<NewNotification, 'link'>) {
    const p = await orderParties(q, orderId);
    if (!p) return;
    const body = [n.body, p.order_number].filter(Boolean).join(' · ');
    const title = n.title.replace('{customer}', p.customer_name);
    await this.notify(q, [to === 'CUSTOMER' ? p.customer_id : p.owner_id], { ...n, title, body, link: `/orders/${orderId}` });
  },

  async notifyAdmins(q: Queryable, n: NewNotification) {
    const { rows } = await q.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ADMIN' AND is_active`);
    await this.notify(q, rows.map((r) => r.id), n);
  },

  // ---------- API ----------
  async list(userId: string, q: { page: number; limit: number; unread_only?: boolean }) {
    const [items, unread] = await Promise.all([
      db.query(
        `SELECT id, type, title, body, link, read_at, created_at FROM notifications
         WHERE user_id = $1 AND ($2::bool = FALSE OR read_at IS NULL)
         ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
        [userId, q.unread_only ?? false, q.limit, (q.page - 1) * q.limit],
      ),
      db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]),
    ]);
    return { items: items.rows, unread: unread.rows[0].n };
  },

  /** Marks the given notifications (only the caller's own) or all of them as read. */
  async markRead(userId: string, ids?: string[]) {
    if (ids && !ids.length) throw AppError.badRequest('ids must not be empty', 'VALIDATION_ERROR');
    const { rowCount } = await db.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [userId, ids ?? null],
    );
    return { marked: rowCount ?? 0 };
  },
};
