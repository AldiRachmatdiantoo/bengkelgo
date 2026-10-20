import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';

export type UserRole = 'CUSTOMER' | 'GUEST' | 'WORKSHOP_OWNER' | 'ADMIN';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

const ISSUER = 'bengkel-api';
const AUDIENCE = 'bengkel-web';

export function signAccessToken(payload: AccessTokenPayload, secret = env.JWT_ACCESS_SECRET, ttl = env.JWT_ACCESS_TTL): string {
  return jwt.sign({ role: payload.role }, secret, {
    subject: payload.sub,
    expiresIn: ttl as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret = env.JWT_ACCESS_SECRET): AccessTokenPayload {
  const decoded = jwt.verify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'], // pin algorithm: blocks alg=none / algorithm-confusion attacks
  }) as jwt.JwtPayload;
  if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub, role: decoded.role as UserRole };
}
