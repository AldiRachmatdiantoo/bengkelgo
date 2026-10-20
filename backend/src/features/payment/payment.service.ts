import { db, withTransaction, type Queryable } from '../../common/db/transaction';
import { localNow } from '../../common/utils/time';
import { audit, setActor, type ActorRole } from '../../common/db/actor';
import { notificationService as notif } from '../notification/notification.service';
import { AppError } from '../../common/errors/AppError';
import type { AllowedImageMime } from '../../common/middlewares/upload';
import type { UserRole } from '../../common/utils/jwt';
import { deleteStored, saveImage } from '../../common/utils/storage';
import { workshopRepository } from '../workshop/workshop.repository';

interface PaymentRow {
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

const PAYABLE_ORDER_STATUSES = ['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

const SELECT_PAYMENT = `
  SELECT t.order_id, o.order_number, o.status AS order_status, o.customer_id, o.workshop_id, t.amount, t.status,
         t.proof_path, t.proof_mime, w.qris_image_path, t.uploaded_at, t.verified_at, t.rejection_reason,
         t.refunded_at, t.refund_note, t.invoice_number, t.payer_reference, t.payer_name
  FROM transactions t JOIN orders o ON o.id = t.order_id LEFT JOIN workshops w ON w.id = o.workshop_id
  WHERE t.order_id = $1`;

const view = (p: PaymentRow) => ({
  order_id: p.order_id,
  order_number: p.order_number,
  amount: p.amount,
  status: p.status,
  has_proof: Boolean(p.proof_path),
  has_qris: Boolean(p.qris_image_path),
  uploaded_at: p.uploaded_at,
  verified_at: p.verified_at,
  rejection_reason: p.rejection_reason,
  refunded_at: p.refunded_at,
  refund_note: p.refund_note,
  invoice_number: p.invoice_number,
  payer_reference: p.payer_reference,
  payer_name: p.payer_name,
});

/** INV-YYYYMMDD-000001: issued once, when a payment is verified (business-timezone date). */
async function nextInvoiceNumber(tx: Queryable) {
  const { rows } = await tx.query<{ seq: number }>(`SELECT nextval('invoice_number_seq') AS seq`);
  return `INV-${localNow().date.replace(/-/g, '')}-${String(rows[0].seq).padStart(6, '0')}`;
}

/** BOLA guard: customer of the order, owner of the assigned workshop, or admin. */
async function loadAuthorized(user: { id: string; role: UserRole }, orderId: string) {
  const { rows } = await db.query<PaymentRow>(SELECT_PAYMENT, [orderId]);
  const p = rows[0];
  if (!p) throw AppError.notFound('Payment not found');
  if (user.role === 'ADMIN' || p.customer_id === user.id) return p;
  if (user.role === 'WORKSHOP_OWNER' && p.workshop_id) {
    const w = await workshopRepository.findByOwner(db, user.id);
    if (w?.id === p.workshop_id) return p;
  }
  throw AppError.notFound('Payment not found');
}

export const paymentService = {
  async get(user: { id: string; role: UserRole }, orderId: string) {
    return view(await loadAuthorized(user, orderId));
  },

  /** PBI-401: static QRIS image of the workshop assigned to the order. */
  async qrisFile(user: { id: string; role: UserRole }, orderId: string) {
    const p = await loadAuthorized(user, orderId);
    if (!p.qris_image_path) throw AppError.notFound('Workshop has not uploaded a QRIS code yet', 'QRIS_NOT_AVAILABLE');
    return p.qris_image_path;
  },

  async proofFile(user: { id: string; role: UserRole }, orderId: string) {
    const p = await loadAuthorized(user, orderId);
    if (!p.proof_path) throw AppError.notFound('No payment proof uploaded', 'PROOF_NOT_FOUND');
    return p.proof_path;
  },

  /** PBI-401 / FR-PAY-01: file already validated (type via magic bytes, size < 2MB) by middleware. */
  async uploadProof(
    customerId: string,
    orderId: string,
    file: { buffer: Buffer; mimetype: string },
    payer: { payerReference?: string; payerName?: string } = {},
    role: ActorRole = 'CUSTOMER',
  ) {
    const key = await saveImage('proofs', file.buffer, file.mimetype as AllowedImageMime);
    let previous: string | null = null;
    try {
      const result = await withTransaction(async (tx) => {
        await setActor(tx, { id: customerId, role });
        const { rows } = await tx.query<PaymentRow>(`${SELECT_PAYMENT} FOR UPDATE OF t`, [orderId]);
        const p = rows[0];
        if (!p || p.customer_id !== customerId) throw AppError.notFound('Payment not found');
        if (!PAYABLE_ORDER_STATUSES.includes(p.order_status)) {
          throw AppError.conflict(`Order in status ${p.order_status} cannot be paid yet`, 'ORDER_NOT_PAYABLE');
        }
        if (p.status === 'VERIFIED') throw AppError.conflict('Payment is already verified', 'ALREADY_VERIFIED');
        if (p.amount <= 0) throw AppError.conflict('Order amount has not been set by the workshop yet', 'AMOUNT_NOT_SET');
        previous = p.proof_path;
        await tx.query(
          `UPDATE transactions SET proof_path = $2, proof_mime = $3, status = 'PENDING_VERIFICATION', uploaded_at = NOW(),
             rejection_reason = NULL, verified_at = NULL, verified_by = NULL, payer_reference = $4, payer_name = $5, updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, key, file.mimetype, payer.payerReference ?? null, payer.payerName ?? null],
        );
        await notif.notifyOrder(tx, orderId, 'OWNER', { type: 'PAYMENT_PROOF', title: 'Bukti bayar masuk dari {customer}', body: notif.rupiah(p.amount) });
        return {
          ...view(p),
          status: 'PENDING_VERIFICATION',
          has_proof: true,
          rejection_reason: null,
          payer_reference: payer.payerReference ?? null,
          payer_name: payer.payerName ?? null,
        };
      });
      await deleteStored(previous);
      return result;
    } catch (err) {
      await deleteStored(key); // never leave orphaned files behind a rolled-back transaction
      throw err;
    }
  },

  /** PBI-402: workshop owner approves or rejects the uploaded proof. */
  async verify(ownerId: string, orderId: string, input: { approve: boolean; reason?: string }) {
    const workshop = await workshopRepository.findByOwner(db, ownerId);
    return withTransaction(async (tx) => {
      const actor = { id: ownerId, role: 'WORKSHOP_OWNER' as const };
      await setActor(tx, actor);
      const { rows } = await tx.query<PaymentRow>(`${SELECT_PAYMENT} FOR UPDATE OF t`, [orderId]);
      const p = rows[0];
      // Only the owner of the workshop assigned to this order may verify (BOLA).
      if (!p || !workshop || p.workshop_id !== workshop.id) throw AppError.notFound('Payment not found');
      if (p.status !== 'PENDING_VERIFICATION') throw AppError.conflict(`Payment is ${p.status}, nothing to verify`, 'INVALID_PAYMENT_STATE');
      if (!input.approve && !input.reason) throw AppError.badRequest('reason is required when rejecting', 'REASON_REQUIRED');
      const status = input.approve ? 'VERIFIED' : 'REJECTED';
      const invoice = input.approve && !p.invoice_number ? await nextInvoiceNumber(tx) : p.invoice_number;
      await tx.query(
        `UPDATE transactions SET status = $2, verified_by = $3, verified_at = NOW(), rejection_reason = $4, invoice_number = $5, updated_at = NOW()
         WHERE order_id = $1`,
        [orderId, status, ownerId, input.approve ? null : input.reason, invoice],
      );
      await audit(tx, actor, {
        action: input.approve ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
        entity: 'order',
        entityId: orderId,
        details: { amount: p.amount, invoice_number: invoice, reason: input.approve ? null : input.reason, payer_reference: p.payer_reference },
      });
      await notif.notifyOrder(tx, orderId, 'CUSTOMER', input.approve
        ? { type: 'PAYMENT_VERIFIED', title: 'Pembayaran lunas', body: `${notif.rupiah(p.amount)} · ${invoice}` }
        : { type: 'PAYMENT_REJECTED', title: 'Bukti bayar ditolak', body: input.reason ?? null });
      return { order_id: orderId, status, rejection_reason: input.approve ? null : input.reason, invoice_number: invoice };
    });
  },
};
