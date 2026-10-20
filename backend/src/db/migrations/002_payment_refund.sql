-- =====================================================================
-- 002_payment_refund.sql : refund status for paid orders that are cancelled
-- Money goes straight to the workshop's own QRIS, so the platform cannot refund it: the workshop
-- returns it to the customer and confirms that in the app, which moves the payment to REFUNDED.
-- (ADD VALUE inside a transaction is fine on PostgreSQL 12+ as long as the value isn't used in it.)
-- =====================================================================
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE transactions
  ADD COLUMN refunded_at  TIMESTAMPTZ,
  ADD COLUMN refunded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN refund_note  TEXT;
