import { notificationService } from '../notification/notification.service';
import crypto from 'crypto';
import { queueEmailAfterCommit } from '../../common/mail/outbox';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { db, withTransaction, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { DUMMY_PASSWORD_HASH, generateOpaqueToken, hashPassword, sha256, verifyPassword } from '../../common/utils/crypto';
import { signAccessToken } from '../../common/utils/jwt';
import { workshopRepository } from '../workshop/workshop.repository';
import { authRepository, type UserRow } from './auth.repository';
import { passwordChangedEmail, passwordResetEmail, verificationEmail } from './auth.email';
import type { GoogleInput, GuestInput, LoginInput, RegisterCustomerInput, RegisterWorkshopInput } from './auth.schema';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export type PublicUser = Pick<UserRow, 'id' | 'name' | 'email' | 'phone' | 'role'> & { email_verified: boolean };

const toPublic = (u: UserRow): PublicUser => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, email_verified: Boolean(u.email && u.email_verified_at) });

// ---------- email verification (6-digit code) ----------
const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 60;
const RESET_TTL_MINUTES = 30;
const RESET_RESEND_SECONDS = 60;

/** Keyed hash, so a leaked table can't be brute-forced offline without the server secret. */
const codeHash = (userId: string, code: string) => crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`email-verify:${userId}:${code}`).digest('hex');

/** Creates a new code for the account and queues the email (sent once the transaction commits). */
async function sendVerificationCode(q: Queryable, user: Pick<UserRow, 'id' | 'name' | 'email'>) {
  if (!user.email) return;
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await authRepository.saveVerificationCode(q, user.id, codeHash(user.id, code), CODE_TTL_MINUTES);
  await queueEmailAfterCommit(q, verificationEmail(user.email, user.name, code, CODE_TTL_MINUTES), { user_id: user.id, kind: 'email_verification' });
}

async function issueTokens(q: Queryable, user: UserRow, userAgent?: string, familyId: string = crypto.randomUUID()) {
  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const id = await authRepository.insertRefreshToken(q, {
    userId: user.id,
    tokenHash: sha256(refreshToken),
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent,
  });
  return { id, accessToken: signAccessToken({ sub: user.id, role: user.role }), refreshToken, refreshExpiresAt };
}

async function result(q: Queryable, user: UserRow, userAgent?: string): Promise<AuthResult> {
  const t = await issueTokens(q, user, userAgent);
  return { user: toPublic(user), accessToken: t.accessToken, refreshToken: t.refreshToken, refreshExpiresAt: t.refreshExpiresAt };
}

let googleClient: OAuth2Client | null = null;
function google() {
  if (!env.googleEnabled) throw new AppError(503, 'GOOGLE_DISABLED', 'Google sign-in is not configured');
  googleClient ??= new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
  return googleClient;
}

/** Test seam: lets tests replace the Google verification step. */
export const googleVerifier = {
  async exchange(code: string, codeVerifier: string): Promise<{ sub: string; email: string; name: string; emailVerified: boolean }> {
    const client = google();
    const { tokens } = await client
      .getToken({ code, codeVerifier, redirect_uri: env.GOOGLE_REDIRECT_URI })
      .catch(() => {
        throw AppError.unauthorized('Google authorization code is invalid or expired', 'GOOGLE_AUTH_FAILED');
      });
    if (!tokens.id_token) throw AppError.unauthorized('Google did not return an ID token', 'GOOGLE_AUTH_FAILED');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID }).catch(() => {
      throw AppError.unauthorized('Google ID token verification failed', 'GOOGLE_AUTH_FAILED');
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw AppError.unauthorized('Google profile is incomplete', 'GOOGLE_AUTH_FAILED');
    return { sub: p.sub, email: p.email.toLowerCase(), name: p.name ?? p.email.split('@')[0], emailVerified: Boolean(p.email_verified) };
  },
};

export const authService = {
  async registerCustomer(input: RegisterCustomerInput, userAgent?: string): Promise<AuthResult> {
    const passwordHash = await hashPassword(input.password);
    return withTransaction(async (tx) => {
      if (await authRepository.findUserByEmail(tx, input.email)) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      const user = await authRepository.createUser(tx, { name: input.name, email: input.email, phone: input.phone, passwordHash, role: 'CUSTOMER' });
      await sendVerificationCode(tx, user);
      return result(tx, user, userAgent);
    });
  },

  /** Creates owner account + PENDING workshop atomically; admin approval required before it is visible. */
  async registerWorkshop(input: RegisterWorkshopInput, userAgent?: string) {
    const passwordHash = await hashPassword(input.owner.password);
    return withTransaction(async (tx) => {
      if (await authRepository.findUserByEmail(tx, input.owner.email)) throw AppError.conflict('Email is already registered', 'EMAIL_TAKEN');
      const user = await authRepository.createUser(tx, {
        name: input.owner.name,
        email: input.owner.email,
        phone: input.owner.phone,
        passwordHash,
        role: 'WORKSHOP_OWNER',
      });
      const workshop = await workshopRepository.create(tx, { ownerId: user.id, ...input.workshop });
      await sendVerificationCode(tx, user);
      await notificationService.notifyAdmins(tx, { type: 'WORKSHOP_REGISTERED', title: 'Pendaftaran mitra baru', body: workshop.name, link: '/admin/workshops' });
      return { ...(await result(tx, user, userAgent)), workshop };
    });
  },

  async login(input: LoginInput, userAgent?: string): Promise<AuthResult> {
    const user = await authRepository.findUserByEmail(db, input.email);
    // Always run bcrypt so response time doesn't reveal whether the email exists.
    const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.password_hash || !valid) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    if (!user.is_active) throw AppError.forbidden('Account is disabled', 'ACCOUNT_DISABLED');
    return result(db, user, userAgent);
  },

  /** Google Authorization Code + PKCE. Unknown emails are auto-registered as CUSTOMER. */
  async google(input: GoogleInput, userAgent?: string): Promise<AuthResult & { isNewUser: boolean }> {
    const profile = await googleVerifier.exchange(input.code, input.code_verifier);
    if (!profile.emailVerified) throw AppError.unauthorized('Google email is not verified', 'GOOGLE_EMAIL_UNVERIFIED');

    return withTransaction(async (tx) => {
      let isNewUser = false;
      let user = await authRepository.findUserByGoogleSub(tx, profile.sub);
      if (!user) {
        user = await authRepository.findUserByEmail(tx, profile.email);
        if (user) {
          await authRepository.linkGoogle(tx, user.id, profile.sub);
          user = (await authRepository.findUserById(tx, user.id))!;
        }
        else {
          user = await authRepository.createUser(tx, { name: profile.name.slice(0, 100), email: profile.email, role: 'CUSTOMER', googleSub: profile.sub, emailVerified: true });
          isNewUser = true;
        }
      }
      if (!user.is_active) throw AppError.forbidden('Account is disabled', 'ACCOUNT_DISABLED');
      return { ...(await result(tx, user, userAgent)), isNewUser };
    });
  },

  /** Quick guest session for emergencies: name + WhatsApp + GPS, no password. */
  async guest(input: GuestInput, userAgent?: string): Promise<AuthResult> {
    return withTransaction(async (tx) => {
      const user = await authRepository.createUser(tx, {
        name: input.name,
        phone: input.whatsapp,
        role: 'GUEST',
        lat: input.latitude,
        lng: input.longitude,
      });
      return result(tx, user, userAgent);
    });
  },

  /**
   * Refresh Token Rotation with reuse detection: each refresh token is single-use.
   * Presenting an already-rotated token revokes the entire token family (likely theft).
   */
  async refresh(rawToken: string, userAgent?: string): Promise<AuthResult> {
    const outcome = await withTransaction(async (tx) => {
      const stored = await authRepository.findRefreshTokenForUpdate(tx, sha256(rawToken));
      if (!stored) return { error: 'INVALID' as const };
      if (stored.revoked_at) {
        await authRepository.revokeFamily(tx, stored.family_id);
        return { error: 'REUSED' as const };
      }
      if (stored.expires_at.getTime() <= Date.now()) {
        await authRepository.revokeToken(tx, stored.id, null);
        return { error: 'EXPIRED' as const };
      }
      const user = await authRepository.findUserById(tx, stored.user_id);
      if (!user || !user.is_active) {
        await authRepository.revokeFamily(tx, stored.family_id);
        return { error: 'INVALID' as const };
      }
      const next = await issueTokens(tx, user, userAgent, stored.family_id);
      await authRepository.revokeToken(tx, stored.id, next.id);
      return {
        value: { user: toPublic(user), accessToken: next.accessToken, refreshToken: next.refreshToken, refreshExpiresAt: next.refreshExpiresAt },
      };
    });
    if ('error' in outcome) {
      if (outcome.error === 'REUSED') throw AppError.unauthorized('Refresh token reuse detected; all sessions revoked', 'TOKEN_REUSED');
      if (outcome.error === 'EXPIRED') throw AppError.unauthorized('Refresh token expired', 'TOKEN_EXPIRED');
      throw AppError.unauthorized('Invalid refresh token', 'TOKEN_INVALID');
    }
    return outcome.value;
  },

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await withTransaction(async (tx) => {
      const stored = await authRepository.findRefreshTokenForUpdate(tx, sha256(rawToken));
      if (stored) await authRepository.revokeFamily(tx, stored.family_id);
    });
  },

  /**
   * "Forgot password": mails a single-use link (30 minutes) to an active account with an email. The answer is the
   * same whether or not the email exists, so nobody can probe which addresses have an account; a new link at
   * most once a minute (repeats within that minute are silently skipped).
   */
  async forgotPassword(email: string) {
    await withTransaction(async (tx) => {
      const user = await authRepository.findUserByEmail(tx, email);
      if (!user?.email || !user.is_active || user.role === 'GUEST') return;
      const last = await authRepository.lastResetRequest(tx, user.id);
      if (last && Date.now() - last.getTime() < RESET_RESEND_SECONDS * 1000) return;
      const token = generateOpaqueToken(32);
      await authRepository.saveResetToken(tx, user.id, sha256(token), RESET_TTL_MINUTES);
      await queueEmailAfterCommit(tx, passwordResetEmail(user.email, user.name, token, RESET_TTL_MINUTES), { user_id: user.id, kind: 'password_reset' });
    });
    return { sent: true };
  },

  /** Sets a new password from a reset link: single use, ends every session, and tells the owner by email. */
  async resetPassword(token: string, newPassword: string) {
    const passwordHash = await hashPassword(newPassword);
    await withTransaction(async (tx) => {
      const userId = await authRepository.consumeResetToken(tx, sha256(token));
      const user = userId ? await authRepository.findUserById(tx, userId) : null;
      if (!user || !user.is_active) throw AppError.unprocessable('This link is invalid or has expired', 'RESET_TOKEN_INVALID');
      await authRepository.setPassword(tx, user.id, passwordHash);
      if (user.email) await queueEmailAfterCommit(tx, passwordChangedEmail(user.email, user.name), { user_id: user.id, kind: 'password_changed' });
    });
    return { reset: true };
  },

  /** Confirms the account's email with the code that was mailed to it. */
  async verifyEmail(userId: string, code: string): Promise<PublicUser> {
    return withTransaction(async (tx) => {
      const user = await authRepository.findUserById(tx, userId);
      if (!user?.email) throw AppError.notFound('User not found');
      if (user.email_verified_at) return toPublic(user);
      const v = await authRepository.findVerificationForUpdate(tx, userId);
      if (!v || v.expires_at.getTime() <= Date.now()) throw AppError.unprocessable('The code has expired, request a new one', 'VERIFICATION_CODE_EXPIRED');
      if (v.attempts >= MAX_CODE_ATTEMPTS) throw AppError.unprocessable('Too many wrong codes, request a new one', 'VERIFICATION_TOO_MANY_ATTEMPTS');
      const given = Buffer.from(codeHash(userId, code));
      const expected = Buffer.from(v.code_hash);
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        await authRepository.countVerificationAttempt(tx, userId);
        return { error: true as const };
      }
      await authRepository.markEmailVerified(tx, userId);
      return toPublic({ ...user, email_verified_at: new Date().toISOString() });
    }).then((r) => {
      // Thrown outside the transaction so the wrong-attempt counter is committed.
      if ('error' in r) throw AppError.unprocessable('The code is not correct', 'VERIFICATION_CODE_INVALID');
      return r;
    });
  },

  /** Mails a new code (at most once a minute; the route also caps sends per hour). */
  async resendVerification(userId: string) {
    return withTransaction(async (tx) => {
      const user = await authRepository.findUserById(tx, userId);
      if (!user?.email) throw AppError.unprocessable('This account has no email address', 'NO_EMAIL');
      if (user.email_verified_at) return { sent: false, already_verified: true };
      const v = await authRepository.findVerificationForUpdate(tx, userId);
      const wait = v ? Math.ceil((v.sent_at.getTime() + RESEND_AFTER_SECONDS * 1000 - Date.now()) / 1000) : 0;
      if (wait > 0) throw AppError.tooMany(`Wait ${wait} seconds before requesting another code`, 'VERIFICATION_RESEND_TOO_SOON');
      await sendVerificationCode(tx, user);
      return { sent: true, already_verified: false };
    });
  },

  async me(userId: string) {
    const user = await authRepository.findUserById(db, userId);
    if (!user) throw AppError.notFound('User not found');
    return toPublic(user);
  },
};
