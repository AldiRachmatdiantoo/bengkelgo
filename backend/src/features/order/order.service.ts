import { env } from '../../config/env';
import { db, withTransaction, type TxClient } from '../../common/db/transaction';
import { audit, setActor, type Actor, type ActorRole } from '../../common/db/actor';
import { notificationService as notif } from '../notification/notification.service';
import { AppError } from '../../common/errors/AppError';
import type { UserRole } from '../../common/utils/jwt';
import { bookingService } from '../booking/booking.service';
import { workshopRepository } from '../workshop/workshop.repository';
import { orderRepository, type OrderStatus } from './order.repository';
import type { ListOrdersQuery, UpdateStatusInput } from './order.schema';
import { emailOrderAfterCommit } from './order.email';

const DETAIL_SQL = `
  SELECT o.id, o.order_number, o.type, o.status, o.customer_id, o.workshop_id, o.vehicle_type, o.vehicle_plate, o.notes,
         o.total_amount, o.created_at, o.updated_at, o.completed_at, o.cancelled_at, o.cancel_reason, o.cancelled_by,
         json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS customer,
         CASE WHEN w.id IS NULL THEN NULL ELSE json_build_object('id', w.id, 'name', w.name, 'phone', w.phone, 'address', w.address,
           'latitude', ST_Y(w.location::geometry), 'longitude', ST_X(w.location::geometry)) END AS workshop,
         CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id', m.id, 'name', m.name, 'phone', m.phone, 'avg_rating', m.avg_rating) END AS mechanic,
         CASE WHEN e.order_id IS NULL THEN NULL ELSE json_build_object(
           'latitude', ST_Y(e.location::geometry), 'longitude', ST_X(e.location::geometry), 'address_note', e.address_note,
           'problem_description', e.problem_description, 'distance_meters', e.distance_meters,
           'response_deadline', e.response_deadline, 'routing_attempts', e.routing_attempts,
           'price_min', e.price_min, 'price_max', e.price_max, 'problem_category', e.problem_category) END AS emergency,
         CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object('id', v.id, 'vehicle_type', v.vehicle_type, 'brand', v.brand,
           'model', v.model, 'year', v.year, 'color', v.color, 'plate', v.plate) END AS vehicle,
         CASE WHEN b.order_id IS NULL THEN NULL ELSE json_build_object(
           'service_id', b.service_id, 'service_name', s.name, 'booking_date', b.booking_date,
           'time_slot', to_char(b.time_slot, 'HH24:MI'), 'queue_number', b.queue_number) END AS booking,
         json_build_object('status', t.status, 'amount', t.amount, 'uploaded_at', t.uploaded_at,
           'verified_at', t.verified_at, 'rejection_reason', t.rejection_reason,
           'refunded_at', t.refunded_at, 'refund_note', t.refund_note,
           'invoice_number', t.invoice_number, 'payer_reference', t.payer_reference, 'payer_name', t.payer_name) AS payment,
         EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id) AS reviewed
  FROM orders o
  JOIN users c ON c.id = o.customer_id
  LEFT JOIN workshops w ON w.id = o.workshop_id
  LEFT JOIN mechanics m ON m.id = o.mechanic_id
  LEFT JOIN emergency_details e ON e.order_id = o.id
  LEFT JOIN booking_details b ON b.order_id = o.id
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN transactions t ON t.order_id = o.id
  LEFT JOIN vehicles v ON v.id = o.vehicle_id`;

/** Allowed owner-driven transitions per order type. */
const OWNER_TRANSITIONS: Record<string, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  BOOKING: { CONFIRMED: ['IN_PROGRESS', 'CANCELLED'], IN_QUEUE: ['CANCELLED'], IN_PROGRESS: ['COMPLETED'] },
  EMERGENCY: { ACCEPTED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED'] },
};
const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'IN_QUEUE', 'ACCEPTED'];

export function canTransition(type: string, from: OrderStatus, to: OrderStatus): boolean {
  return OWNER_TRANSITIONS[type]?.[from]?.includes(to) ?? false;
}

async function lockPaymentStatus(tx: TxClient, orderId: string) {
  const { rows } = await tx.query<{ status: string }>(`SELECT status FROM transactions WHERE order_id = $1 FOR UPDATE`, [orderId]);
  return rows[0]?.status;
}

/**
 * Money of a cancelled order must not stay "paid". Payments go straight to the workshop's QRIS, so the
 * workshop returns the money itself and confirms it here (payment -> REFUNDED). A proof that is still
 * waiting for verification has to be verified or rejected first, so no transfer is left unaccounted for.
 */
async function settlePaymentOnOwnerCancel(tx: TxClient, orderId: string, ownerId: string, input: UpdateStatusInput) {
  const payment = await lockPaymentStatus(tx, orderId);
  if (payment === 'PENDING_VERIFICATION') {
    throw AppError.conflict('Verify or reject the payment proof before cancelling this order', 'PAYMENT_PENDING_VERIFICATION');
  }
  if (payment !== 'VERIFIED') return;
  if (!input.refund_confirmed) {
    throw AppError.conflict('This order is paid: return the money to the customer and confirm the refund to cancel', 'REFUND_CONFIRMATION_REQUIRED');
  }
  const { rows } = await tx.query<{ amount: number }>(
    `UPDATE transactions SET status = 'REFUNDED', refunded_at = NOW(), refunded_by = $2, refund_note = $3, updated_at = NOW()
     WHERE order_id = $1 RETURNING amount`,
    [orderId, ownerId, input.refund_note ?? null],
  );
  await audit(tx, { id: ownerId, role: 'WORKSHOP_OWNER' }, {
    action: 'PAYMENT_REFUNDED',
    entity: 'order',
    entityId: orderId,
    details: { amount: rows[0].amount, note: input.refund_note ?? null },
  });
  await notif.notifyOrder(tx, orderId, 'CUSTOMER', { type: 'PAYMENT_REFUNDED', title: 'Dana dikembalikan bengkel', body: notif.rupiah(rows[0].amount) });
}

const STATUS_NOTICE: Record<string, { type: string; title: string }> = {
  IN_PROGRESS: { type: 'ORDER_IN_PROGRESS', title: 'Pesanan mulai dikerjakan' },
  COMPLETED: { type: 'ORDER_COMPLETED', title: 'Pesanan selesai' },
};

export const orderService = {
  async listForCustomer(customerId: string, q: ListOrdersQuery) {
    const { rows } = await db.query(
      `${DETAIL_SQL}
       WHERE o.customer_id = $1 AND ($2::order_status IS NULL OR o.status = $2) AND ($3::order_type IS NULL OR o.type = $3)
       ORDER BY o.created_at DESC LIMIT $4 OFFSET $5`,
      [customerId, q.status ?? null, q.type ?? null, q.limit, (q.page - 1) * q.limit],
    );
    return rows;
  },

  async listForWorkshop(ownerId: string, q: ListOrdersQuery) {
    const w = await workshopRepository.findByOwner(db, ownerId);
    if (!w) throw AppError.notFound('You have no registered workshop', 'WORKSHOP_NOT_FOUND');
    const { rows } = await db.query(
      `${DETAIL_SQL}
       WHERE o.workshop_id = $1 AND ($2::order_status IS NULL OR o.status = $2) AND ($3::order_type IS NULL OR o.type = $3)
         AND ($4::date IS NULL OR b.booking_date = $4 OR (b.order_id IS NULL AND (o.created_at AT TIME ZONE $7::text)::date = $4))
       ORDER BY o.created_at DESC LIMIT $5 OFFSET $6`,
      [w.id, q.status ?? null, q.type ?? null, q.date ?? null, q.limit, (q.page - 1) * q.limit, env.CRON_TIMEZONE],
    );
    return rows;
  },

  /** Object-level authorisation: only the customer, the assigned workshop's owner, or an admin. */
  async detail(user: { id: string; role: UserRole }, orderId: string) {
    const { rows } = await db.query(`${DETAIL_SQL} WHERE o.id = $1`, [orderId]);
    const order = rows[0];
    if (!order) throw AppError.notFound('Order not found');
    if (user.role === 'ADMIN' || order.customer_id === user.id) return order;
    if (user.role === 'WORKSHOP_OWNER' && order.workshop_id) {
      const w = await workshopRepository.findByOwner(db, user.id);
      if (w && w.id === order.workshop_id) return order;
    }
    throw AppError.notFound('Order not found');
  },

  /** Item 11: order + payment status timeline (same access rule as the order itself). */
  async history(user: { id: string; role: UserRole }, orderId: string) {
    await this.detail(user, orderId);
    const { rows } = await db.query(
      `SELECT h.kind, h.from_status, h.to_status, h.actor_role, u.name AS actor_name, h.created_at
       FROM order_status_history h LEFT JOIN users u ON u.id = h.actor_id
       WHERE h.order_id = $1 ORDER BY h.id`,
      [orderId],
    );
    return rows;
  },

  async updateStatus(ownerId: string, orderId: string, input: UpdateStatusInput) {
    const w = await workshopRepository.findByOwner(db, ownerId);
    if (!w) throw AppError.notFound('Order not found');
    return withTransaction(async (tx) => {
      const actor: Actor = { id: ownerId, role: 'WORKSHOP_OWNER' };
      await setActor(tx, actor);
      const order = await orderRepository.findByIdForUpdate(tx, orderId);
      if (!order || order.workshop_id !== w.id) throw AppError.notFound('Order not found');
      if (!canTransition(order.type, order.status, input.status)) {
        throw AppError.conflict(`Cannot change order from ${order.status} to ${input.status}`, 'INVALID_TRANSITION');
      }
      if (input.status === 'CANCELLED') {
        await settlePaymentOnOwnerCancel(tx, order.id, ownerId, input);
        if (order.type === 'BOOKING') await bookingService.releaseBooking(tx, order);
        else await orderRepository.setStatus(tx, order.id, 'CANCELLED', { mechanicId: null });
        await orderRepository.recordCancellation(tx, order.id, 'WORKSHOP', input.cancel_reason);
        await audit(tx, actor, { action: 'ORDER_CANCELLED', entity: 'order', entityId: order.id, details: { from: order.status, reason: input.cancel_reason ?? null } });
        await notif.notifyOrder(tx, order.id, 'CUSTOMER', { type: 'ORDER_CANCELLED', title: 'Pesanan dibatalkan bengkel', body: input.cancel_reason ?? null });
        await emailOrderAfterCommit(tx, order.id, 'cancelled_by_workshop');
      } else {
        if (input.status === 'COMPLETED' && order.type === 'EMERGENCY' && input.final_amount === undefined && order.total_amount <= 0) {
          throw AppError.badRequest('final_amount is required to complete an emergency order', 'FINAL_AMOUNT_REQUIRED');
        }
        await orderRepository.setStatus(tx, order.id, input.status, { totalAmount: input.final_amount });
        if (input.final_amount !== undefined) await orderRepository.syncTransactionAmount(tx, order.id, input.final_amount);
        const notice = STATUS_NOTICE[input.status];
        if (notice) {
          const amount = input.final_amount ?? order.total_amount;
          await notif.notifyOrder(tx, order.id, 'CUSTOMER', { ...notice, body: input.status === 'COMPLETED' && amount > 0 ? `Total ${notif.rupiah(amount)}` : null });
        }
        if (input.status === 'COMPLETED') await emailOrderAfterCommit(tx, order.id, 'completed');
      }
      return { id: order.id, previous_status: order.status, status: input.status };
    });
  },

  async cancelByCustomer(customerId: string, orderId: string, reason?: string, role: ActorRole = 'CUSTOMER') {
    return withTransaction(async (tx) => {
      await setActor(tx, { id: customerId, role });
      const order = await orderRepository.findByIdForUpdate(tx, orderId);
      if (!order || order.customer_id !== customerId) throw AppError.notFound('Order not found');
      if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
        throw AppError.conflict(`Order cannot be cancelled while ${order.status}`, 'INVALID_TRANSITION');
      }
      const payment = await lockPaymentStatus(tx, orderId);
      if (payment === 'VERIFIED') throw AppError.conflict('Paid orders must be cancelled by the workshop', 'ORDER_ALREADY_PAID');
      if (payment === 'PENDING_VERIFICATION') {
        throw AppError.conflict('Your payment proof is being checked; contact the workshop to cancel', 'PAYMENT_PENDING_VERIFICATION');
      }

      if (order.type === 'BOOKING') await bookingService.releaseBooking(tx, order);
      else {
        await orderRepository.setStatus(tx, order.id, 'CANCELLED', { mechanicId: null });
        await tx.query(`UPDATE emergency_details SET response_deadline = NULL WHERE order_id = $1`, [orderId]);
      }
      await orderRepository.recordCancellation(tx, order.id, 'CUSTOMER', reason);
      await notif.notifyOrder(tx, order.id, 'OWNER', { type: 'ORDER_CANCELLED', title: 'Pesanan dibatalkan oleh {customer}', body: reason ?? null });
      await emailOrderAfterCommit(tx, order.id, 'cancelled_by_customer');
      return { id: order.id, previous_status: order.status, status: 'CANCELLED' };
    });
  },
};
