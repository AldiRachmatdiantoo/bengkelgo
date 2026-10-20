import type { Queryable } from '../../common/db/transaction';
import { formatOrderNumber } from '../booking/booking.logic';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_QUEUE' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'UNASSIGNED';
export type OrderType = 'EMERGENCY' | 'BOOKING';

export interface OrderRow {
  id: string;
  order_number: string;
  type: OrderType;
  status: OrderStatus;
  customer_id: string;
  workshop_id: string | null;
  mechanic_id: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  vehicle_id: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

const ORDER_COLS = `id, order_number, type, status, customer_id, workshop_id, mechanic_id, vehicle_type, vehicle_plate, vehicle_id, notes, total_amount, created_at, updated_at`;

export const orderRepository = {
  async nextOrderNumber(q: Queryable, prefix: 'BK' | 'EM') {
    const { rows } = await q.query<{ seq: number }>(`SELECT nextval('order_number_seq') AS seq`);
    return formatOrderNumber(prefix, rows[0].seq);
  },

  async insert(
    q: Queryable,
    o: {
      orderNumber: string; type: OrderType; status: OrderStatus; customerId: string; workshopId: string | null; mechanicId?: string | null;
      vehicleType: string; vehiclePlate?: string | null; vehicleId?: string | null; notes?: string | null; totalAmount: number;
    },
  ) {
    const { rows } = await q.query<OrderRow>(
      `INSERT INTO orders (order_number, type, status, customer_id, workshop_id, mechanic_id, vehicle_type, vehicle_plate, notes, total_amount, vehicle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${ORDER_COLS}`,
      [o.orderNumber, o.type, o.status, o.customerId, o.workshopId, o.mechanicId ?? null, o.vehicleType, o.vehiclePlate ?? null, o.notes ?? null, o.totalAmount, o.vehicleId ?? null],
    );
    return rows[0];
  },

  async insertTransaction(q: Queryable, orderId: string, amount: number) {
    await q.query(`INSERT INTO transactions (order_id, amount) VALUES ($1, $2)`, [orderId, amount]);
  },

  async findByIdForUpdate(q: Queryable, id: string) {
    const { rows } = await q.query<OrderRow>(`SELECT ${ORDER_COLS} FROM orders WHERE id = $1 FOR UPDATE`, [id]);
    return rows[0] ?? null;
  },

  async findById(q: Queryable, id: string) {
    const { rows } = await q.query<OrderRow>(`SELECT ${ORDER_COLS} FROM orders WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async setStatus(q: Queryable, id: string, status: OrderStatus, extra: { mechanicId?: string | null; totalAmount?: number } = {}) {
    await q.query(
      `UPDATE orders SET status = $2::order_status,
         mechanic_id = CASE WHEN $3::bool THEN $4::uuid ELSE mechanic_id END,
         total_amount = COALESCE($5, total_amount),
         completed_at = CASE WHEN $2::order_status = 'COMPLETED' THEN NOW() ELSE completed_at END,
         cancelled_at = CASE WHEN $2::order_status = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
         updated_at = NOW()
       WHERE id = $1`,
      [id, status, extra.mechanicId !== undefined, extra.mechanicId ?? null, extra.totalAmount ?? null],
    );
  },

  async recordCancellation(q: Queryable, id: string, by: 'CUSTOMER' | 'WORKSHOP', reason?: string) {
    await q.query(`UPDATE orders SET cancelled_by = $2, cancel_reason = $3 WHERE id = $1`, [id, by, reason ?? null]);
  },

  /** Keeps the payment amount in sync with the order unless already settled (verified or refunded). */
  async syncTransactionAmount(q: Queryable, orderId: string, amount: number) {
    await q.query(
      `UPDATE transactions SET amount = $2, updated_at = NOW() WHERE order_id = $1 AND status NOT IN ('VERIFIED', 'REFUNDED')`,
      [orderId, amount],
    );
  },
};
