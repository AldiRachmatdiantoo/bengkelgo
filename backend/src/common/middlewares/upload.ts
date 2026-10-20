import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

/**
 * Detects the real image type from magic bytes. The client-supplied Content-Type and
 * file extension are never trusted (prevents disguised HTML/SVG/script uploads).
 */
export function detectImageMime(buf: Buffer): AllowedImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

const multerImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.mimetype)) {
      return cb(AppError.badRequest('Only JPEG, PNG or WEBP images are allowed', 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

/** Single image upload (<2MB, JPEG/PNG/WEBP) with magic-byte verification (FR-PAY-01). */
export function imageUpload(field: string) {
  const handler = multerImage.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (!req.file) return next(AppError.badRequest(`Image file "${field}" is required`, 'FILE_REQUIRED'));
      const real = detectImageMime(req.file.buffer);
      if (!real) return next(AppError.badRequest('File content is not a valid image', 'INVALID_FILE_TYPE'));
      req.file.mimetype = real;
      next();
    });
  };
}
