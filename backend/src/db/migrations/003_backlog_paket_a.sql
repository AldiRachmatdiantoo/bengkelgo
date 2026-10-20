-- =====================================================================
-- 003_backlog_paket_a.sql : small additive columns (no new tables, existing rows untouched)
-- =====================================================================

-- Customer's budget range for an SOS (previously appended to problem_description by the web app)
ALTER TABLE emergency_details
  ADD COLUMN price_min NUMERIC(12,2) CHECK (price_min >= 0),
  ADD COLUMN price_max NUMERIC(12,2) CHECK (price_max >= 0),
  ADD CONSTRAINT emergency_price_range CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max);

-- Soft delete of services (bookings keep referencing them)
ALTER TABLE services ADD COLUMN deleted_at TIMESTAMPTZ;

-- Workshop owner's public reply to a review
ALTER TABLE reviews
  ADD COLUMN owner_reply TEXT,
  ADD COLUMN replied_at  TIMESTAMPTZ;

-- Why and by whom an order was cancelled
ALTER TABLE orders
  ADD COLUMN cancel_reason TEXT,
  ADD COLUMN cancelled_by  VARCHAR(10) CHECK (cancelled_by IN ('CUSTOMER', 'WORKSHOP'));

-- Invoice number (issued when a payment is verified) and the payer's own reference for matching transfers
CREATE SEQUENCE invoice_number_seq;
ALTER TABLE transactions
  ADD COLUMN invoice_number  VARCHAR(30) UNIQUE,
  ADD COLUMN payer_reference VARCHAR(64),
  ADD COLUMN payer_name      VARCHAR(100);
