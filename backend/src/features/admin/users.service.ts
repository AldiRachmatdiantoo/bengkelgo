import { db, withTransaction } from '../../common/db/transaction';
import { audit } from '../../common/db/actor';
import { AppError } from '../../common/errors/AppError';
import { hashPassword } from '../../common/utils/crypto';
import type { UserRole } from '../../common/utils/jwt';

/**
 * BE-15 access management: list accounts, switch them off/on, add admins.
 * Deactivating an account blocks login and refresh at once (all refresh tokens are revoked);
 * an access token already issued stays valid until it expires (max. JWT_ACCESS_TTL, 15 minutes).
 */
export const usersService = {
  async list(q: { role?: UserRole; q?: string; active?: boolean; page: number; limit: number }) {
    const like = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
              w.id AS workshop_id, w.name AS workshop_name,
              (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = u.id) AS orders
       FROM users u LEFT JOIN workshops w ON w.owner_id = u.id
       WHERE ($1::user_role IS NULL OR u.role = $1)
         AND ($2::text IS NULL OR u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)
         AND ($3::bool IS NULL OR u.is_active = $3)
       ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
      [q.role ?? null, like, q.active ?? null, q.limit, (q.page - 1) * q.limit],
    );
    return rows;
  },

  async setActive(adminId: string, userId: string, active: boolean, reason?: string) {
    if (userId === adminId && !active) throw AppError.unprocessable('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    return withTransaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; role: UserRole; is_active: boolean; name: string }>(
        'SELECT id, role, is_active, name FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      const u = rows[0];
      if (!u) throw AppError.notFound('User not found');
      if (u.is_active === active) return { id: u.id, is_active: active };
      if (!active && u.role === 'ADMIN') {
        // Serialise admin changes so two admins can't switch each other off at the same time.
        await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended('admins', 0))`);
        const { rows: left } = await tx.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN' AND is_active AND id <> $1`, [userId]);
        if (left[0].n === 0) throw AppError.unprocessable('At least one active admin must remain', 'LAST_ADMIN');
      }
      await tx.query('UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1', [userId, active]);
      if (!active) await tx.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      await audit(tx, { id: adminId, role: 'ADMIN' }, {
        action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'user',
        entityId: userId,
        details: { role: u.role, name: u.name, reason: reason ?? null },
      });
      return { id: u.id, is_active: active };
    });
  },

  async createAdmin(adminId: string, input: { name: string; email: string; phone?: string; password: string }) {
    const passwordHash = await hashPassword(input.password);
    return withTransaction(async (tx) => {
      const { rows: taken } = await tx.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
      if (taken.length) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      const { rows } = await tx.query<{ id: string; name: string; email: string; role: UserRole; is_active: boolean; created_at: string }>(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'ADMIN')
         RETURNING id, name, email, role, is_active, created_at`,
        [input.name, input.email, input.phone ?? null, passwordHash],
      );
      await audit(tx, { id: adminId, role: 'ADMIN' }, { action: 'ADMIN_CREATED', entity: 'user', entityId: rows[0].id, details: { email: input.email } });
      return rows[0];
    });
  },
};
