-- =====================================================================
-- 007_email_verification.sql : confirm the email address of new accounts with a 6-digit code
-- =====================================================================
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Accounts that existed before this check keep working exactly as before.
UPDATE users SET email_verified_at = created_at WHERE email IS NOT NULL;

-- At most one live code per account; a new code replaces the old one.
CREATE TABLE email_verifications (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,                    -- HMAC of the code, never the code itself
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   SMALLINT NOT NULL DEFAULT 0,      -- wrong guesses on this code
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
