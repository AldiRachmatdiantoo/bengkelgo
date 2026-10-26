import crypto from 'crypto';
import { audit } from '../../common/db/actor';
import { db, withTransaction, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { queueEmailAfterCommit } from '../../common/mail/outbox';
import { hashPassword, sha256, verifyPassword } from '../../common/utils/crypto';
import { profilePhoto } from '../../common/utils/photos';
import { deleteStored, saveImage } from '../../common/utils/storage';
import { env } from '../../config/env';
import { passwordChangedEmail } from '../auth/auth.email';
import { authRepository, type UserRow } from '../auth/auth.repository';
import { toPublic } from '../auth/auth.service';
import { accountDeletedEmail, emailChangeCodeEmail, emailChangedEmail } from './account.email';
import { accountRepository } from './account.repository';
import type { ChangePasswordInput, DeleteAccountInput, EmailChangeInput, UpdateProfileInput } from './account.schema';

const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 60;

/** Keyed hash bound to the account AND the new address, so a code can only confirm the change it was sent for. */
const codeHash = (userId: string, newEmail: string, code: string) =>
  crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`email-change:${userId}:${newEmail}:${code}`).digest('hex');

const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function lockUser(q: Queryable, userId: string) {
  const user = await authRepository.findUserById(q, userId, true);
  if (!user || !user.is_active) throw AppError.notFound('User not found');
  return user;
}

/** Sensitive changes ask for the current password, when the account has one (Google-only accounts do not). */
async function checkPassword(user: UserRow, given: string | undefined) {
  if (!user.password_hash) return;
  if (!given) throw AppError.unprocessable('Enter your current password', 'PASSWORD_REQUIRED');
  if (!(await verifyPassword(given, user.password_hash))) throw AppError.unprocessable('The current password is not correct', 'WRONG_PASSWORD');
}

/** The device making the request (its refresh-token family), from the session cookie; null when unknown. */
async function currentFamily(userId: string, rawRefreshToken: string | undefined) {
  return rawRefreshToken ? accountRepository.familyOfToken(db, userId, sha256(rawRefreshToken)) : null;
}

export const accountService = {
  async updateProfile(userId: string, input: UpdateProfileInput) {
    return withTransaction(async (tx) => {
      await lockUser(tx, userId);
      await accountRepository.updateProfile(tx, userId, input);
      return toPublic((await authRepository.findUserById(tx, userId))!);
    });
  },

  // ---------- profile photo ----------
  async setPhoto(userId: string, file: { buffer: Buffer }) {
    // A small WebP portrait without camera data (location) is all the app ever shows.
    const key = await saveImage('photos', await profilePhoto(file.buffer), 'image/webp');
    const prev = await accountRepository.setPhoto(db, userId, key).catch(async (err) => {
      await deleteStored(key);
      throw err;
    });
    if (!prev) {
      await deleteStored(key);
      throw AppError.notFound('User not found');
    }
    await deleteStored(prev.old);
    return toPublic((await authRepository.findUserById(db, userId))!);
  },

  async removePhoto(userId: string) {
    const prev = await accountRepository.setPhoto(db, userId, null);
    if (!prev) throw AppError.notFound('User not found');
    await deleteStored(prev.old);
    return toPublic((await authRepository.findUserById(db, userId))!);
  },

  async photoFile(userId: string) {
    const user = await authRepository.findUserById(db, userId);
    if (!user?.photo_path) throw AppError.notFound('Photo not found');
    return user.photo_path;
  },

  // ---------- password ----------
  /**
   * Changes the password (the current one is required), or sets the first one for an account made with Google.
   * Every other device is signed out; this one stays signed in. The owner is told by email.
   */
  async changePassword(userId: string, input: ChangePasswordInput, rawRefreshToken?: string) {
    const passwordHash = await hashPassword(input.new_password);
    const keep = await currentFamily(userId, rawRefreshToken);
    return withTransaction(async (tx) => {
      const user = await lockUser(tx, userId);
      await checkPassword(user, input.current_password);
      await accountRepository.setPassword(tx, userId, passwordHash);
      const signedOut = await accountRepository.revokeOtherFamilies(tx, userId, keep);
      if (user.email) {
        await queueEmailAfterCommit(tx, passwordChangedEmail(user.email, user.name, user.password_hash ? 'changed' : 'created'), {
          user_id: userId,
          kind: 'password_changed',
        });
      }
      return { user: toPublic({ ...user, password_hash: passwordHash }), signed_out_devices: signedOut };
    });
  },

  // ---------- change of email ----------
  async pendingEmailChange(userId: string) {
    const p = await accountRepository.findEmailChange(db, userId);
    if (!p || p.expires_at.getTime() <= Date.now()) return null;
    return { new_email: p.new_email, sent_at: p.sent_at, expires_at: p.expires_at };
  },

  /** Mails a code to the new address; nothing changes until that code is entered. */
  async requestEmailChange(userId: string, input: EmailChangeInput) {
    return withTransaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (input.email === user.email) throw AppError.unprocessable('This is already your email address', 'SAME_EMAIL');
      await checkPassword(user, input.password);
      if (await accountRepository.emailTaken(tx, input.email, userId)) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      const prev = await accountRepository.findEmailChange(tx, userId, true);
      if (prev && prev.new_email === input.email) {
        const wait = Math.ceil((prev.sent_at.getTime() + RESEND_AFTER_SECONDS * 1000 - Date.now()) / 1000);
        if (wait > 0) throw AppError.tooMany(`Wait ${wait} seconds before requesting another code`, 'VERIFICATION_RESEND_TOO_SOON');
      }
      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      await accountRepository.saveEmailChange(tx, userId, input.email, codeHash(userId, input.email, code), CODE_TTL_MINUTES);
      await queueEmailAfterCommit(tx, emailChangeCodeEmail(input.email, user.name, code, CODE_TTL_MINUTES), { user_id: userId, kind: 'email_change' });
      return { new_email: input.email, expires_in_minutes: CODE_TTL_MINUTES };
    });
  },

  async confirmEmailChange(userId: string, code: string) {
    const outcome = await withTransaction(async (tx) => {
      const user = await lockUser(tx, userId);
      const p = await accountRepository.findEmailChange(tx, userId, true);
      if (!p || p.expires_at.getTime() <= Date.now()) throw AppError.unprocessable('The code has expired, request a new one', 'VERIFICATION_CODE_EXPIRED');
      if (p.attempts >= MAX_CODE_ATTEMPTS) throw AppError.unprocessable('Too many wrong codes, request a new one', 'VERIFICATION_TOO_MANY_ATTEMPTS');
      if (!sameHash(codeHash(userId, p.new_email, code), p.code_hash)) {
        await accountRepository.countEmailChangeAttempt(tx, userId);
        return { wrong: true as const };
      }
      // Someone may have signed up with that address since the code was sent.
      if (await accountRepository.emailTaken(tx, p.new_email, userId)) {
        await accountRepository.deleteEmailChange(tx, userId);
        throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      }
      await accountRepository.applyEmail(tx, userId, p.new_email);
      await audit(tx, { id: userId, role: user.role }, { action: 'USER_EMAIL_CHANGED', entity: 'user', entityId: userId, details: { from: user.email, to: p.new_email } });
      if (user.email) await queueEmailAfterCommit(tx, emailChangedEmail(user.email, user.name, p.new_email), { user_id: userId, kind: 'email_changed' });
      return { user: toPublic({ ...user, email: p.new_email, email_verified_at: new Date().toISOString() }) };
    });
    // Thrown outside the transaction so the wrong-attempt counter is committed.
    if ('wrong' in outcome) throw AppError.unprocessable('The code is not correct', 'VERIFICATION_CODE_INVALID');
    return outcome.user;
  },

  async cancelEmailChange(userId: string) {
    await accountRepository.deleteEmailChange(db, userId);
    return { cancelled: true };
  },

  // ---------- signed-in devices ----------
  async sessions(userId: string, rawRefreshToken?: string) {
    const [rows, current] = await Promise.all([accountRepository.activeSessions(db, userId), currentFamily(userId, rawRefreshToken)]);
    return rows.map((s) => ({ id: s.family_id, user_agent: s.user_agent, signed_in_at: s.signed_in, last_active_at: s.last_active, current: s.family_id === current }));
  },

  async revokeSession(userId: string, sessionId: string) {
    if (!(await accountRepository.revokeFamily(db, userId, sessionId))) throw AppError.notFound('Session not found');
    return { id: sessionId, revoked: true };
  },

  /** Signs out every device except this one. */
  async revokeOtherSessions(userId: string, rawRefreshToken?: string) {
    const keep = await currentFamily(userId, rawRefreshToken);
    return { signed_out_devices: await accountRepository.revokeOtherFamilies(db, userId, keep) };
  },

  // ---------- account deletion ----------
  /**
   * A customer deletes the account (privacy policy: the right to have the account and its data removed).
   * Only without unfinished orders, confirmed with the password (or the word HAPUS for Google-only accounts).
   */
  async deleteAccount(userId: string, input: DeleteAccountInput) {
    let photo: string | null = null;
    await withTransaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (user.role !== 'CUSTOMER') throw AppError.forbidden('Only customer accounts can be deleted here; contact the admin', 'ACCOUNT_DELETE_NOT_ALLOWED');
      if (user.password_hash) await checkPassword(user, input.password);
      else if (input.confirm?.toUpperCase() !== 'HAPUS') throw AppError.unprocessable('Type HAPUS to confirm', 'DELETE_CONFIRMATION_REQUIRED');
      const open = await accountRepository.countUnfinishedOrders(tx, userId);
      if (open > 0) throw AppError.conflict(`Finish or cancel your ${open} open order(s) first`, 'ACCOUNT_HAS_OPEN_ORDERS');
      photo = user.photo_path;
      await accountRepository.anonymise(tx, userId);
      await audit(tx, { id: userId, role: 'CUSTOMER' }, { action: 'USER_DELETED', entity: 'user', entityId: userId, details: { by: 'self' } });
      if (user.email) await queueEmailAfterCommit(tx, accountDeletedEmail(user.email, user.name), { user_id: userId, kind: 'account_deleted' });
    });
    await deleteStored(photo);
    return { deleted: true };
  },
};
