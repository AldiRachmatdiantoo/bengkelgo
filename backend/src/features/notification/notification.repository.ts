import type { Queryable } from '../../common/db/transaction';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationRepository = {
  /** One row per user, all in a single statement. */
  async insertMany(q: Queryable, userIds: string[], n: { type: string; title: string; body: string | null; link: string | null }) {
    await q.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT u, $2, $3, $4, $5 FROM unnest($1::uuid[]) AS u`,
      [userIds, n.type, n.title, n.body, n.link],
    );
  },

  /** Who is on each side of an order (customer + owner of the assigned workshop, if any). */
  async orderParties(q: Queryable, orderId: string) {
    const { rows } = await q.query<{ customer_id: string; customer_name: string; owner_id: string | null; order_number: string; type: string }>(
      `SELECT o.customer_id, c.name AS customer_name, w.owner_id, o.order_number, o.type
       FROM orders o JOIN users c ON c.id = o.customer_id LEFT JOIN workshops w ON w.id = o.workshop_id WHERE o.id = $1`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  async activeAdminIds(q: Queryable) {
    const { rows } = await q.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ADMIN' AND is_active`);
    return rows.map((r) => r.id);
  },

  async list(q: Queryable, userId: string, p: { limit: number; offset: number; unreadOnly: boolean }) {
    const { rows } = await q.query<NotificationRow>(
      `SELECT id, type, title, body, link, read_at, created_at FROM notifications
       WHERE user_id = $1 AND ($2::bool = FALSE OR read_at IS NULL)
       ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
      [userId, p.unreadOnly, p.limit, p.offset],
    );
    return rows;
  },

  async countUnread(q: Queryable, userId: string) {
    const { rows } = await q.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]);
    return rows[0].n;
  },

  /** Marks the given notifications (only the user's own) or all of them as read; returns how many changed. */
  async markRead(q: Queryable, userId: string, ids: string[] | null) {
    const { rowCount } = await q.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [userId, ids],
    );
    return rowCount ?? 0;
  },
};
