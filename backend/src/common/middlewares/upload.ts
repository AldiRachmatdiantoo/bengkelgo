import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { HeicConversionError, heicToJpeg, isHeic } from '../utils/heic';

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

/** Browsers send HEIC as image/heic(-f), or with no type at all (application/octet-stream). */
const ACCEPTED_UPLOAD_TYPES = [...ALLOWED_IMAGE_MIME, 'image/heic', 'image/heif', 'application/octet-stream'];

const multerImage = multer({
  storage: multer.memoryStorage(),
  // The larger HEIC allowance is the hard cap; JPEG/PNG/WEBP are held to MAX_UPLOAD_BYTES below.
  limits: { fileSize: Math.max(env.MAX_UPLOAD_BYTES, env.MAX_HEIC_UPLOAD_BYTES), files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.mimetype)) {
      return cb(AppError.badRequest('Only JPEG, PNG, WEBP or HEIC images are allowed', 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

const tooLarge = () => AppError.badRequest(`File exceeds ${Math.floor(env.MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`, 'FILE_TOO_LARGE');

/**
 * Single image upload with magic-byte verification (FR-PAY-01): JPEG/PNG/WEBP under 2MB are stored as sent;
 * iPhone HEIC photos are converted to a JPEG under 2MB first (`maxSide` px at most; QR codes need more pixels).
 */
export function imageUpload(field: string, opts: { maxSide?: number } = {}) {
  const handler = multerImage.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, async (err?: unknown) => {
      if (err) return next(err);
      const file = req.file;
      if (!file) return next(AppError.badRequest(`Image file "${field}" is required`, 'FILE_REQUIRED'));
      const real = detectImageMime(file.buffer);
      if (real) {
        if (file.buffer.length > env.MAX_UPLOAD_BYTES) return next(tooLarge());
        file.mimetype = real;
        return next();
      }
      if (!isHeic(file.buffer)) return next(AppError.badRequest('File content is not a valid image', 'INVALID_FILE_TYPE'));
      try {
        file.buffer = await heicToJpeg(file.buffer, opts.maxSide ?? 1600, env.MAX_UPLOAD_BYTES);
        file.size = file.buffer.length;
        file.mimetype = 'image/jpeg';
        next();
      } catch (e) {
        if (e instanceof HeicConversionError) {
          if (e.reason === 'too_large') return next(tooLarge());
          if (e.reason === 'too_many_pixels') return next(AppError.badRequest('This iPhone photo is too large to convert on the server', 'HEIC_TOO_LARGE'));
          if (e.reason === 'disabled') return next(AppError.badRequest('HEIC photos are converted in the browser on this server', 'HEIC_NOT_SUPPORTED'));
          return next(AppError.badRequest('The iPhone photo could not be read', 'INVALID_FILE_TYPE'));
        }
        next(e);
      }
    });
  };
}
