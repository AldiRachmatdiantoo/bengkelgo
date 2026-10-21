import { db, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { notificationRepository as repo } from './notification.repository';

export interface NewNotification {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

const rupiah = (n: number) => `Rp${Math.round(Number(n)).toLocaleString('id-ID')}`;

export const notificationService = {
  rupiah,

  /** Inserted inside the caller's transaction, so a rolled-back action never leaves a notification behind. */
  async notify(q: Queryable, userIds: (string | null | undefined)[], n: NewNotification) {
    const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
    if (!ids.length) return;
    await repo.insertMany(q, ids, { type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null });
  },

  /**
   * Notifies one side of an order; the order number is appended to the body and the link points at the order.
   * `{customer}` in the title is replaced by the customer's name (useful on the workshop side).
   */
  async notifyOrder(q: Queryable, orderId: string, to: 'CUSTOMER' | 'OWNER', n: Omit<NewNotification, 'link'>) {
    const p = await repo.orderParties(q, orderId);
    if (!p) return;
    const body = [n.body, p.order_number].filter(Boolean).join(' · ');
    const title = n.title.replace('{customer}', p.customer_name);
    await this.notify(q, [to === 'CUSTOMER' ? p.customer_id : p.owner_id], { ...n, title, body, link: `/orders/${orderId}` });
  },

  async notifyAdmins(q: Queryable, n: NewNotification) {
    await this.notify(q, await repo.activeAdminIds(q), n);
  },

  // ---------- API ----------
  async list(userId: string, q: { page: number; limit: number; unread_only?: boolean }) {
    const [items, unread] = await Promise.all([
      repo.list(db, userId, { limit: q.limit, offset: (q.page - 1) * q.limit, unreadOnly: q.unread_only ?? false }),
      repo.countUnread(db, userId),
    ]);
    return { items, unread };
  },

  /** Marks the given notifications (only the caller's own) or all of them as read. */
  async markRead(userId: string, ids?: string[]) {
    if (ids && !ids.length) throw AppError.badRequest('ids must not be empty', 'VALIDATION_ERROR');
    return { marked: await repo.markRead(db, userId, ids ?? null) };
  },
};
