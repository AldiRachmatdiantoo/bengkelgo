import type { Queryable } from '../../common/db/transaction';
import type { UserRole } from '../../common/utils/jwt';

export const usersRepository = {
  /** Accounts with their workshop (owners) and order count; `like` is an already-escaped ILIKE pattern. */
  async list(q: Queryable, f: { role: UserRole | null; like: string | null; active: boolean | null; limit: number; offset: number }) {
    const { rows } = await q.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.email_verified_at, u.created_at,
              w.id AS workshop_id, w.name AS workshop_name,
              (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = u.id) AS orders
       FROM users u LEFT JOIN workshops w ON w.owner_id = u.id
       WHERE ($1::user_role IS NULL OR u.role = $1)
         AND ($2::text IS NULL OR u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)
         AND ($3::bool IS NULL OR u.is_active = $3)
       ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
      [f.role, f.like, f.active, f.limit, f.offset],
    );
    return rows;
  },

  async lock(q: Queryable, userId: string) {
    const { rows } = await q.query<{ id: string; role: UserRole; is_active: boolean; name: string }>(
      'SELECT id, role, is_active, name FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    return rows[0] ?? null;
  },

  /** Serialises admin (de)activation so two admins can't switch each other off at the same time. */
  async lockAdmins(q: Queryable) {
    await q.query(`SELECT pg_advisory_xact_lock(hashtextextended('admins', 0))`);
  },

  async countOtherActiveAdmins(q: Queryable, exceptUserId: string) {
    const { rows } = await q.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN' AND is_active AND id <> $1`, [exceptUserId]);
    return rows[0].n;
  },

  async setActive(q: Queryable, userId: string, active: boolean) {
    await q.query('UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1', [userId, active]);
  },

  /** Ends every session of the user: refresh is refused from now on. */
  async revokeSessions(q: Queryable, userId: string) {
    await q.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  },

  /** Marks the address confirmed; null when the account doesn't exist or has no email. Returns the earlier value. */
  async markEmailVerified(q: Queryable, userId: string) {
    const { rows } = await q.query<{ id: string; email: string; was_verified: boolean }>(
      `UPDATE users u SET email_verified_at = COALESCE(u.email_verified_at, NOW()), updated_at = NOW()
       FROM (SELECT id, email_verified_at IS NOT NULL AS was_verified FROM users WHERE id = $1 FOR UPDATE) old
       WHERE u.id = old.id AND u.email IS NOT NULL
       RETURNING u.id, u.email, old.was_verified`,
      [userId],
    );
    if (rows[0]) await q.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
    return rows[0] ?? null;
  },

  async emailTaken(q: Queryable, email: string) {
    const { rows } = await q.query('SELECT 1 FROM users WHERE email = $1', [email]);
    return rows.length > 0;
  },

  async insertAdmin(q: Queryable, a: { name: string; email: string; phone: string | null; passwordHash: string }) {
    const { rows } = await q.query<{ id: string; name: string; email: string; role: UserRole; is_active: boolean; created_at: string }>(
      `INSERT INTO users (name, email, phone, password_hash, role, email_verified_at) VALUES ($1, $2, $3, $4, 'ADMIN', NOW())
       RETURNING id, name, email, role, is_active, created_at`,
      [a.name, a.email, a.phone, a.passwordHash],
    );
    return rows[0];
  },
};
