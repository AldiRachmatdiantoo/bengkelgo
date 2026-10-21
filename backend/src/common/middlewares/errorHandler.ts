import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../errors/AppError';

/** Maps PostgreSQL error codes to safe client responses (never leaks SQL details). */
function fromPg(err: any): AppError | null {
  switch (err?.code) {
    case '23505':
      return AppError.conflict('Resource already exists', 'DUPLICATE');
    case '23503':
      return AppError.badRequest('Referenced resource does not exist', 'INVALID_REFERENCE');
    case '23514':
      return AppError.unprocessable('Request violates a business constraint', 'CONSTRAINT_VIOLATION');
    case '22P02':
      return AppError.badRequest('Invalid input syntax', 'INVALID_INPUT');
    case '40001':
    case '40P01':
      return new AppError(409, 'CONCURRENCY_CONFLICT', 'Request conflicted with another operation, please retry');
    default:
      return null;
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let appErr: AppError;
  if (err instanceof AppError) appErr = err;
  else if (err instanceof multer.MulterError) {
    appErr =
      err.code === 'LIMIT_FILE_SIZE'
        ? AppError.badRequest(`File exceeds ${Math.floor(Math.max(env.MAX_UPLOAD_BYTES, env.MAX_HEIC_UPLOAD_BYTES) / 1024 / 1024)}MB limit`, 'FILE_TOO_LARGE')
        : AppError.badRequest(err.message, 'UPLOAD_ERROR');
  } else if ((err as any)?.type === 'entity.parse.failed') appErr = AppError.badRequest('Malformed JSON body', 'INVALID_JSON');
  else if ((err as any)?.type === 'entity.too.large') appErr = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
  else appErr = fromPg(err) ?? new AppError(500, 'INTERNAL_ERROR', 'Internal server error');

  if (appErr.statusCode >= 500) logger.error({ err, path: req.path }, 'Unhandled error');

  res.status(appErr.statusCode).json({
    success: false,
    error: { code: appErr.code, message: appErr.message, ...(appErr.details ? { details: appErr.details } : {}) },
  });
}
