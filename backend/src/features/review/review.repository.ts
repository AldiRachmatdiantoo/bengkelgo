import type { Queryable } from '../../common/db/transaction';

export const reviewRepository = {
  /** Row locks taken before recomputing averages, so concurrent reviews can't write stale aggregates. */
  async lockRated(q: Queryable, workshopId: string, mechanicId: string | null) {
    await q.query('SELECT id FROM workshops WHERE id = $1 FOR UPDATE', [workshopId]);
    if (mechanicId) await q.query('SELECT id FROM mechanics WHERE id = $1 FOR UPDATE', [mechanicId]);
  },

  /** Null when the order already has a review (one per order). */
  async insert(q: Queryable, r: { orderId: string; customerId: string; workshopId: string; mechanicId: string | null; rating: number; comment: string | null }) {
    const { rows } = await q.query(
      `INSERT INTO reviews (order_id, customer_id, workshop_id, mechanic_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id, order_id, workshop_id, mechanic_id, rating, comment, created_at`,
      [r.orderId, r.customerId, r.workshopId, r.mechanicId, r.rating, r.comment],
    );
    return rows[0] ?? null;
  },

  async refreshWorkshopRating(q: Queryable, workshopId: string) {
    await q.query(
      `UPDATE workshops SET
         avg_rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE workshop_id = $1),
         total_reviews = (SELECT COUNT(*) FROM reviews WHERE workshop_id = $1), updated_at = NOW()
       WHERE id = $1`,
      [workshopId],
    );
  },

  async refreshMechanicRating(q: Queryable, mechanicId: string) {
    await q.query(
      `UPDATE mechanics SET
         avg_rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE mechanic_id = $1),
         total_reviews = (SELECT COUNT(*) FROM reviews WHERE mechanic_id = $1), updated_at = NOW()
       WHERE id = $1`,
      [mechanicId],
    );
  },

  async listForWorkshop(q: Queryable, workshopId: string, limit: number, offset: number) {
    const { rows } = await q.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name, m.name AS mechanic_name,
              r.owner_reply, r.replied_at
       FROM reviews r JOIN users u ON u.id = r.customer_id LEFT JOIN mechanics m ON m.id = r.mechanic_id
       WHERE r.workshop_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [workshopId, limit, offset],
    );
    return rows;
  },

  /** Sets (or clears, with null) the owner's reply; null when the review isn't on this workshop. */
  async setReply(q: Queryable, workshopId: string, reviewId: string, reply: string | null) {
    const { rows } = await q.query(
      `UPDATE reviews SET owner_reply = $3, replied_at = CASE WHEN $3::text IS NULL THEN NULL ELSE NOW() END
       WHERE id = $1 AND workshop_id = $2
       RETURNING id, rating, comment, created_at, owner_reply, replied_at, customer_id`,
      [reviewId, workshopId, reply],
    );
    return (rows[0] as { customer_id: string; [k: string]: unknown } | undefined) ?? null;
  },
};
