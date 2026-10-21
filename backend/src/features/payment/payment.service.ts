import { db, withTransaction } from '../../common/db/transaction';
import { audit, setActor, type ActorRole } from '../../common/db/actor';
import { notificationService as notif } from '../notification/notification.service';
import { AppError } from '../../common/errors/AppError';
import type { AllowedImageMime } from '../../common/middlewares/upload';
import type { UserRole } from '../../common/utils/jwt';
import { deleteStored, saveImage } from '../../common/utils/storage';
import { workshopRepository } from '../workshop/workshop.repository';
import { paymentRepository, type PaymentRow } from './payment.repository';

const PAYABLE_ORDER_STATUSES = ['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

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

/** BOLA guard: customer of the order, owner of the assigned workshop, or admin. */
async function loadAuthorized(user: { id: string; role: UserRole }, orderId: string) {
  const p = await paymentRepository.find(db, orderId);
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
        const p = await paymentRepository.findForUpdate(tx, orderId);
        if (!p || p.customer_id !== customerId) throw AppError.notFound('Payment not found');
        if (!PAYABLE_ORDER_STATUSES.includes(p.order_status)) {
          throw AppError.conflict(`Order in status ${p.order_status} cannot be paid yet`, 'ORDER_NOT_PAYABLE');
        }
        if (p.status === 'VERIFIED') throw AppError.conflict('Payment is already verified', 'ALREADY_VERIFIED');
        if (p.amount <= 0) throw AppError.conflict('Order amount has not been set by the workshop yet', 'AMOUNT_NOT_SET');
        previous = p.proof_path;
        await paymentRepository.saveProof(tx, orderId, { path: key, mime: file.mimetype, payerReference: payer.payerReference ?? null, payerName: payer.payerName ?? null });
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
      const p = await paymentRepository.findForUpdate(tx, orderId);
      // Only the owner of the workshop assigned to this order may verify (BOLA).
      if (!p || !workshop || p.workshop_id !== workshop.id) throw AppError.notFound('Payment not found');
      if (p.status !== 'PENDING_VERIFICATION') throw AppError.conflict(`Payment is ${p.status}, nothing to verify`, 'INVALID_PAYMENT_STATE');
      if (!input.approve && !input.reason) throw AppError.badRequest('reason is required when rejecting', 'REASON_REQUIRED');
      const status = input.approve ? 'VERIFIED' : 'REJECTED';
      const invoice = input.approve && !p.invoice_number ? await paymentRepository.nextInvoiceNumber(tx) : p.invoice_number;
      await paymentRepository.setVerification(tx, orderId, { status, verifiedBy: ownerId, reason: input.approve ? null : input.reason ?? null, invoiceNumber: invoice });
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
