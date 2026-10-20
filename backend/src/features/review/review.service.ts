import { db, withTransaction } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { orderRepository } from '../order/order.repository';
import { notificationService as notif } from '../notification/notification.service';

export const reviewService = {
  /**
   * PBI-403: one review per COMPLETED order. Workshop & mechanic rows are locked FOR UPDATE before
   * recomputing averages, so concurrent reviews can't overwrite each other with stale aggregates.
   */
  async create(customerId: string, input: { order_id: string; rating: number; comment?: string }) {
    return withTransaction(async (tx) => {
      const order = await orderRepository.findByIdForUpdate(tx, input.order_id);
      if (!order || order.customer_id !== customerId) throw AppError.notFound('Order not found');
      if (order.status !== 'COMPLETED' || !order.workshop_id) throw AppError.conflict('Only completed orders can be reviewed', 'ORDER_NOT_COMPLETED');

      await tx.query('SELECT id FROM workshops WHERE id = $1 FOR UPDATE', [order.workshop_id]);
      if (order.mechanic_id) await tx.query('SELECT id FROM mechanics WHERE id = $1 FOR UPDATE', [order.mechanic_id]);

      const { rows } = await tx.query(
        `INSERT INTO reviews (order_id, customer_id, workshop_id, mechanic_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (order_id) DO NOTHING
         RETURNING id, order_id, workshop_id, mechanic_id, rating, comment, created_at`,
        [order.id, customerId, order.workshop_id, order.mechanic_id, input.rating, input.comment ?? null],
      );
      if (!rows[0]) throw AppError.conflict('This order has already been reviewed', 'ALREADY_REVIEWED');

      await tx.query(
        `UPDATE workshops SET
           avg_rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE workshop_id = $1),
           total_reviews = (SELECT COUNT(*) FROM reviews WHERE workshop_id = $1), updated_at = NOW()
         WHERE id = $1`,
        [order.workshop_id],
      );
      if (order.mechanic_id) {
        await tx.query(
          `UPDATE mechanics SET
             avg_rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE mechanic_id = $1),
             total_reviews = (SELECT COUNT(*) FROM reviews WHERE mechanic_id = $1), updated_at = NOW()
           WHERE id = $1`,
          [order.mechanic_id],
        );
      }
      await notif.notifyOrder(tx, order.id, 'OWNER', { type: 'REVIEW_NEW', title: `Ulasan baru ${input.rating}/5 dari {customer}`, body: input.comment ?? null });
      return rows[0];
    });
  },

  async listForWorkshop(workshopId: string, page: number, limit: number) {
    const { rows } = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name, m.name AS mechanic_name,
              r.owner_reply, r.replied_at
       FROM reviews r JOIN users u ON u.id = r.customer_id LEFT JOIN mechanics m ON m.id = r.mechanic_id
       WHERE r.workshop_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [workshopId, limit, (page - 1) * limit],
    );
    return rows;
  },

  /** Workshop owner's public answer to a review of their own workshop (replaces an earlier reply). */
  async reply(workshopId: string, reviewId: string, reply: string | null) {
    const { rows } = await db.query(
      `UPDATE reviews SET owner_reply = $3, replied_at = CASE WHEN $3::text IS NULL THEN NULL ELSE NOW() END
       WHERE id = $1 AND workshop_id = $2
       RETURNING id, rating, comment, created_at, owner_reply, replied_at`,
      [reviewId, workshopId, reply],
    );
    if (!rows[0]) throw AppError.notFound('Review not found');
    if (reply) {
      const { rows: r } = await db.query<{ customer_id: string; workshop_id: string }>('SELECT customer_id, workshop_id FROM reviews WHERE id = $1', [reviewId]);
      await notif.notify(db, [r[0].customer_id], { type: 'REVIEW_REPLY', title: 'Bengkel membalas ulasan Anda', body: reply, link: `/workshops/${r[0].workshop_id}` });
    }
    return rows[0];
  },
};
