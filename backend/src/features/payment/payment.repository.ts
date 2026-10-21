import type { Queryable } from '../../common/db/transaction';
import { localNow } from '../../common/utils/time';

export interface PaymentRow {
  order_id: string;
  order_number: string;
  order_status: string;
  customer_id: string;
  workshop_id: string | null;
  amount: number;
  status: 'UNPAID' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  proof_path: string | null;
  proof_mime: string | null;
  qris_image_path: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  refunded_at: string | null;
  refund_note: string | null;
  invoice_number: string | null;
  payer_reference: string | null;
  payer_name: string | null;
}

const SELECT_PAYMENT = `
  SELECT t.order_id, o.order_number, o.status AS order_status, o.customer_id, o.workshop_id, t.amount, t.status,
         t.proof_path, t.proof_mime, w.qris_image_path, t.uploaded_at, t.verified_at, t.rejection_reason,
         t.refunded_at, t.refund_note, t.invoice_number, t.payer_reference, t.payer_name
  FROM transactions t JOIN orders o ON o.id = t.order_id LEFT JOIN workshops w ON w.id = o.workshop_id
  WHERE t.order_id = $1`;

export const paymentRepository = {
  /** Payment of an order with its order and workshop context (null when none). */
  async find(q: Queryable, orderId: string) {
    const { rows } = await q.query<PaymentRow>(SELECT_PAYMENT, [orderId]);
    return rows[0] ?? null;
  },

  /** Same, locking the transaction row until the caller's transaction ends. */
  async findForUpdate(q: Queryable, orderId: string) {
    const { rows } = await q.query<PaymentRow>(`${SELECT_PAYMENT} FOR UPDATE OF t`, [orderId]);
    return rows[0] ?? null;
  },

  /** A new proof replaces the previous one and resets any earlier verification. */
  async saveProof(q: Queryable, orderId: string, p: { path: string; mime: string; payerReference: string | null; payerName: string | null }) {
    await q.query(
      `UPDATE transactions SET proof_path = $2, proof_mime = $3, status = 'PENDING_VERIFICATION', uploaded_at = NOW(),
         rejection_reason = NULL, verified_at = NULL, verified_by = NULL, payer_reference = $4, payer_name = $5, updated_at = NOW()
       WHERE order_id = $1`,
      [orderId, p.path, p.mime, p.payerReference, p.payerName],
    );
  },

  async setVerification(q: Queryable, orderId: string, v: { status: 'VERIFIED' | 'REJECTED'; verifiedBy: string; reason: string | null; invoiceNumber: string | null }) {
    await q.query(
      `UPDATE transactions SET status = $2, verified_by = $3, verified_at = NOW(), rejection_reason = $4, invoice_number = $5, updated_at = NOW()
       WHERE order_id = $1`,
      [orderId, v.status, v.verifiedBy, v.reason, v.invoiceNumber],
    );
  },

  /** INV-YYYYMMDD-000001: issued once, when a payment is verified (business-timezone date). */
  async nextInvoiceNumber(q: Queryable) {
    const { rows } = await q.query<{ seq: number }>(`SELECT nextval('invoice_number_seq') AS seq`);
    return `INV-${localNow().date.replace(/-/g, '')}-${String(rows[0].seq).padStart(6, '0')}`;
  },
};
