-- =====================================================================
-- 010_user_profile.sql : "Akun saya" (profile photo, change of email, account deletion)
-- =====================================================================
ALTER TABLE users
  ADD COLUMN photo_path TEXT,                -- profile photo (WebP, storage key); NULL = initial letter
  ADD COLUMN deleted_at TIMESTAMPTZ;         -- set when a customer deletes the account (personal data anonymised)

-- A change of email waits here until the code mailed to the NEW address is entered. One per account.
CREATE TABLE email_changes (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_email  VARCHAR(255) NOT NULL CHECK (new_email = LOWER(new_email)),
  code_hash  TEXT NOT NULL,                    -- HMAC of the code, never the code itself
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   SMALLINT NOT NULL DEFAULT 0,      -- wrong guesses on this code
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
