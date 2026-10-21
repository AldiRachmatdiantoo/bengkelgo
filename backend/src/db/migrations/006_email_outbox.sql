-- =====================================================================
-- 006_email_outbox.sql : durable email queue
-- Emails are written in the same transaction as the action that causes them, then delivered by the API;
-- failed sends are retried from this table, so a restart never loses one.
-- =====================================================================
CREATE TABLE email_outbox (
  id              BIGSERIAL PRIMARY KEY,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  body_html       TEXT,
  context         JSONB,                          -- e.g. { "order_id": ..., "kind": "confirmed" }, for logs/support
  status          VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempts        INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

-- The delivery job only ever looks at due, pending rows.
CREATE INDEX idx_email_outbox_due ON email_outbox(next_attempt_at) WHERE status = 'PENDING';
-- Old sent/failed rows are purged (they hold email addresses).
CREATE INDEX idx_email_outbox_created ON email_outbox(created_at) WHERE status <> 'PENDING';
