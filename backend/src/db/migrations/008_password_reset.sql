-- =====================================================================
-- 008_password_reset.sql : "forgot password" links sent by email
-- =====================================================================
-- At most one live link per account; asking again replaces it. Only a hash of the token is stored.
CREATE TABLE password_resets (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
