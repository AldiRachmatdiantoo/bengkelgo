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
  created_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const USER_COLS = 'id, name, email, phone, password_hash, role, google_sub, is_active, created_at';

export const authRepository = {
  async findUserByEmail(q: Queryable, email: string) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE email = $1`, [email]);
    return rows[0] ?? null;
  },

  async findUserById(q: Queryable, id: string) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findUserByGoogleSub(q: Queryable, sub: string) {
    const { rows } = await q.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE google_sub = $1`, [sub]);
    return rows[0] ?? null;
  },

  async createUser(
    q: Queryable,
    u: { name: string; email?: string | null; phone?: string | null; passwordHash?: string | null; role: UserRole; googleSub?: string | null; lat?: number; lng?: number },
  ) {
    const { rows } = await q.query<UserRow>(
      `INSERT INTO users (name, email, phone, password_hash, role, google_sub, last_location)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $7::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($8::float8, $7::float8), 4326)::geography END)
       RETURNING ${USER_COLS}`,
      [u.name, u.email ?? null, u.phone ?? null, u.passwordHash ?? null, u.role, u.googleSub ?? null, u.lat ?? null, u.lng ?? null],
    );
    return rows[0];
  },

  async linkGoogle(q: Queryable, userId: string, sub: string) {
    await q.query('UPDATE users SET google_sub = $2, updated_at = NOW() WHERE id = $1', [userId, sub]);
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
