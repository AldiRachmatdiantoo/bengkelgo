import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** A bcrypt hash of a random value, compared against when a user doesn't exist (timing-attack mitigation). */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

/** Opaque, high-entropy refresh token (sent to the client) */
export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Only the SHA-256 hash of refresh tokens is persisted. */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
