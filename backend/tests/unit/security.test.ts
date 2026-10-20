import jwt from 'jsonwebtoken';
import { generateOpaqueToken, hashPassword, sha256, verifyPassword } from '../../src/common/utils/crypto';
import { signAccessToken, verifyAccessToken } from '../../src/common/utils/jwt';
import { detectImageMime } from '../../src/common/middlewares/upload';
import { safeText, password } from '../../src/common/middlewares/validate';

describe('JWT utility', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CUSTOMER' });
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', role: 'CUSTOMER' });
  });

  it('rejects a token signed with another secret', () => {
    const token = signAccessToken({ sub: 'u', role: 'ADMIN' }, 'another-secret-another-secret-another-secret');
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects alg=none tokens (algorithm pinning)', () => {
    const forged = jwt.sign({ role: 'ADMIN' }, '', { algorithm: 'none', subject: 'attacker', issuer: 'bengkel-api', audience: 'bengkel-web' });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects expired tokens', () => {
    const token = signAccessToken({ sub: 'u', role: 'CUSTOMER' }, undefined, '-1s');
    expect(() => verifyAccessToken(token)).toThrow(/expired/);
  });

  it('rejects tokens for a different audience', () => {
    const token = jwt.sign({ role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { subject: 'x', issuer: 'bengkel-api', audience: 'other' });
    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe('Password hashing & token hashing', () => {
  it('hashes with bcrypt and verifies', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(verifyPassword('Sup3rSecret!', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('generates unique high-entropy opaque tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });

  it('sha256 is deterministic hex', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('Upload magic-byte detection', () => {
  it('detects real image types', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectImageMime(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary'))).toBe('image/webp');
  });

  it('rejects disguised payloads', () => {
    expect(detectImageMime(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(detectImageMime(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('Input sanitisation', () => {
  it('strips angle brackets from free text (stored XSS)', () => {
    expect(safeText(100).parse('  <script>alert(1)</script> hi ')).toBe('scriptalert(1)/script hi');
  });

  it('enforces password policy', () => {
    expect(password.safeParse('weak').success).toBe(false);
    expect(password.safeParse('alllowercase1').success).toBe(false);
    expect(password.safeParse('GoodPass123').success).toBe(true);
  });
});
