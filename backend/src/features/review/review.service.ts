import { db, withTransaction } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { orderRepository } from '../order/order.repository';
import { notificationService as notif } from '../notification/notification.service';
import { reviewRepository } from './review.repository';

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

      await reviewRepository.lockRated(tx, order.workshop_id, order.mechanic_id);
      const review = await reviewRepository.insert(tx, {
        orderId: order.id,
        customerId,
        workshopId: order.workshop_id,
        mechanicId: order.mechanic_id,
        rating: input.rating,
        comment: input.comment ?? null,
      });
      if (!review) throw AppError.conflict('This order has already been reviewed', 'ALREADY_REVIEWED');

      await reviewRepository.refreshWorkshopRating(tx, order.workshop_id);
      if (order.mechanic_id) await reviewRepository.refreshMechanicRating(tx, order.mechanic_id);
      await notif.notifyOrder(tx, order.id, 'OWNER', { type: 'REVIEW_NEW', title: `Ulasan baru ${input.rating}/5 dari {customer}`, body: input.comment ?? null });
      return review;
    });
  },

  listForWorkshop(workshopId: string, page: number, limit: number) {
    return reviewRepository.listForWorkshop(db, workshopId, limit, (page - 1) * limit);
  },

  /** Workshop owner's public answer to a review of their own workshop (replaces an earlier reply). */
  async reply(workshopId: string, reviewId: string, reply: string | null) {
    const row = await reviewRepository.setReply(db, workshopId, reviewId, reply);
    if (!row) throw AppError.notFound('Review not found');
    const { customer_id: customerId, ...review } = row;
    if (reply) await notif.notify(db, [customerId], { type: 'REVIEW_REPLY', title: 'Bengkel membalas ulasan Anda', body: reply, link: `/workshops/${workshopId}` });
    return review;
  },
};
