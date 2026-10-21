import { db, withTransaction } from '../../common/db/transaction';
import { audit } from '../../common/db/actor';
import { AppError } from '../../common/errors/AppError';
import { hashPassword } from '../../common/utils/crypto';
import type { UserRole } from '../../common/utils/jwt';
import { usersRepository } from './users.repository';

/**
 * BE-15 access management: list accounts, switch them off/on, add admins.
 * Deactivating an account blocks login and refresh at once (all refresh tokens are revoked);
 * an access token already issued stays valid until it expires (max. JWT_ACCESS_TTL, 15 minutes).
 */
export const usersService = {
  list(q: { role?: UserRole; q?: string; active?: boolean; page: number; limit: number }) {
    const like = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    return usersRepository.list(db, { role: q.role ?? null, like, active: q.active ?? null, limit: q.limit, offset: (q.page - 1) * q.limit });
  },

  async setActive(adminId: string, userId: string, active: boolean, reason?: string) {
    if (userId === adminId && !active) throw AppError.unprocessable('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    return withTransaction(async (tx) => {
      const u = await usersRepository.lock(tx, userId);
      if (!u) throw AppError.notFound('User not found');
      if (u.is_active === active) return { id: u.id, is_active: active };
      if (!active && u.role === 'ADMIN') {
        await usersRepository.lockAdmins(tx);
        if ((await usersRepository.countOtherActiveAdmins(tx, userId)) === 0) throw AppError.unprocessable('At least one active admin must remain', 'LAST_ADMIN');
      }
      await usersRepository.setActive(tx, userId, active);
      if (!active) await usersRepository.revokeSessions(tx, userId);
      await audit(tx, { id: adminId, role: 'ADMIN' }, {
        action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'user',
        entityId: userId,
        details: { role: u.role, name: u.name, reason: reason ?? null },
      });
      return { id: u.id, is_active: active };
    });
  },

  /** Support action: confirm a user's email by hand (e.g. the code email never arrived). Audited. */
  async verifyEmail(adminId: string, userId: string) {
    return withTransaction(async (tx) => {
      const u = await usersRepository.markEmailVerified(tx, userId);
      if (!u) throw AppError.notFound('User not found or has no email address');
      if (!u.was_verified) {
        await audit(tx, { id: adminId, role: 'ADMIN' }, { action: 'USER_EMAIL_VERIFIED', entity: 'user', entityId: userId, details: { email: u.email } });
      }
      return { id: u.id, email_verified: true };
    });
  },

  async createAdmin(adminId: string, input: { name: string; email: string; phone?: string; password: string }) {
    const passwordHash = await hashPassword(input.password);
    return withTransaction(async (tx) => {
      if (await usersRepository.emailTaken(tx, input.email)) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      const admin = await usersRepository.insertAdmin(tx, { name: input.name, email: input.email, phone: input.phone ?? null, passwordHash });
      await audit(tx, { id: adminId, role: 'ADMIN' }, { action: 'ADMIN_CREATED', entity: 'user', entityId: admin.id, details: { email: input.email } });
      return admin;
    });
  },
};
