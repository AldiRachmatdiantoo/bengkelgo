import type { Queryable } from '../../common/db/transaction';
import type { UserRole } from '../../common/utils/jwt';

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  role: UserRole;
  google_sub: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  photo_path: string | null;
  created_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const USER_COLS = 'id, name, email, phone, password_hash, role, google_sub, is_active, email_verified_at, photo_path, created_at';

export const authRepository = {
  async findUserByEmail(q: Queryable, email: string) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE email = $1`, [email]);
    return rows[0] ?? null;
  },

  async findUserById(q: Queryable, id: string, forUpdate = false) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [id]);
    return rows[0] ?? null;
  },

  async findUserByGoogleSub(q: Queryable, sub: string) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE google_sub = $1`, [sub]);
    return rows[0] ?? null;
  },

  async createUser(
    q: Queryable,
    u: {
      name: string; email?: string | null; phone?: string | null; passwordHash?: string | null; role: UserRole; googleSub?: string | null;
      lat?: number; lng?: number; emailVerified?: boolean;
    },
  ) {
    const { rows } = await q.query<UserRow>(
      `INSERT INTO users (name, email, phone, password_hash, role, google_sub, last_location, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $7::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($8::float8, $7::float8), 4326)::geography END,
               CASE WHEN $9::bool THEN NOW() END)
       RETURNING ${USER_COLS}`,
      [u.name, u.email ?? null, u.phone ?? null, u.passwordHash ?? null, u.role, u.googleSub ?? null, u.lat ?? null, u.lng ?? null, u.emailVerified ?? false],
    );
    return rows[0];
  },

  /** Google has confirmed the address, so linking also marks the email verified. */
  async linkGoogle(q: Queryable, userId: string, sub: string) {
    await q.query('UPDATE users SET google_sub = $2, email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1', [userId, sub]);
  },

  // ---------- password reset ----------
  /** When the account last asked for a reset link (null if no live link). */
  async lastResetRequest(q: Queryable, userId: string) {
    const { rows } = await q.query<{ created_at: Date }>('SELECT created_at FROM password_resets WHERE user_id = $1', [userId]);
    return rows[0]?.created_at ?? null;
  },

  /** Stores a new link (replacing any earlier one) valid for `ttlMinutes`. */
  async saveResetToken(q: Queryable, userId: string, tokenHash: string, ttlMinutes: number) {
    await q.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES ($1, $2, NOW() + make_interval(mins => $3), NOW())
       ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [userId, tokenHash, ttlMinutes],
    );
  },

  /** Takes a live link out of the table (single use); returns its account, or null if unknown or expired. */
  async consumeResetToken(q: Queryable, tokenHash: string) {
    const { rows } = await q.query<{ user_id: string; live: boolean }>(
      `DELETE FROM password_resets WHERE token_hash = $1 RETURNING user_id, expires_at > NOW() AS live`,
      [tokenHash],
    );
    return rows[0]?.live ? rows[0].user_id : null;
  },

  /** New password; the address is proven (the link reached it), and every session is ended. */
  async setPassword(q: Queryable, userId: string, passwordHash: string) {
    await q.query(
      `UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1`,
      [userId, passwordHash],
    );
    await q.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await q.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
  },

  // ---------- email verification ----------
  /** Stores a new code (replacing any earlier one) with a fresh expiry and attempt counter. */
  async saveVerificationCode(q: Queryable, userId: string, codeHash: string, ttlMinutes: number) {
    await q.query(
      `INSERT INTO email_verifications (user_id, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, NOW() + make_interval(mins => $3), 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = NOW()`,
      [userId, codeHash, ttlMinutes],
    );
  },

  async findVerificationForUpdate(q: Queryable, userId: string) {
    const { rows } = await q.query<{ code_hash: string; expires_at: Date; attempts: number; sent_at: Date }>(
      'SELECT code_hash, expires_at, attempts, sent_at FROM email_verifications WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    return rows[0] ?? null;
  },

  async countVerificationAttempt(q: Queryable, userId: string) {
    await q.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = $1', [userId]);
  },

  async markEmailVerified(q: Queryable, userId: string) {
    await q.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1', [userId]);
    await q.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
  },

  // ---------- refresh tokens ----------
  async insertRefreshToken(q: Queryable, t: { userId: string; tokenHash: string; familyId: string; expiresAt: Date; userAgent?: string }) {
    const { rows } = await q.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [t.userId, t.tokenHash, t.familyId, t.expiresAt, t.userAgent?.slice(0, 255) ?? null],
    );
    return rows[0].id;
  },

  async findRefreshTokenForUpdate(q: Queryable, tokenHash: string) {
    const { rows } = await q.query<RefreshTokenRow>(
      `SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  async revokeToken(q: Queryable, id: string, replacedBy: string | null) {
    await q.query('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1', [id, replacedBy]);
  },

  async revokeFamily(q: Queryable, familyId: string) {
    await q.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL', [familyId]);
  },
};
