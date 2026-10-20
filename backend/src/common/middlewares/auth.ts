import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { verifyAccessToken, type UserRole } from '../utils/jwt';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Requires a valid access token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) return next(AppError.unauthorized());
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
  }
}

/** Attaches the user when a valid token is present, but never rejects (public + customer endpoints). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      return next(AppError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
    }
  }
  next();
}

/** Role-based access control (least privilege). Must run after `authenticate`. */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

export function currentUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
