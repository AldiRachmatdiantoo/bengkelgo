import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';
import { AppError } from '../errors/AppError';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

/**
 * Validates & sanitises request input with Zod before it reaches the controller.
 * Parsed (typed, stripped of unknown keys) values are exposed on `req.valid`.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const valid: Record<string, unknown> = {};
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        return next(
          AppError.badRequest('Validation failed', 'VALIDATION_ERROR', {
            location: key,
            issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          }),
        );
      }
      valid[key] = result.data;
    }
    req.valid = valid as Request['valid'];
    next();
  };
}

/** Typed accessor for validated input inside controllers. */
export function input<B = unknown, Q = unknown, P = unknown>(req: Request) {
  return req.valid as { body: B; query: Q; params: P };
}

// ---------- Shared schema primitives ----------
/** Trims and strips HTML angle brackets to neutralise stored-XSS payloads in free text. */
export const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[<>]/g, ''));

export const uuidParam = (name: string) => z.object({ [name]: z.uuid() });
export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);
export const phoneId = z
  .string()
  .trim()
  .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, 'Must be a valid Indonesian WhatsApp number');
export const vehicleType = z.enum(['MOTOR', 'MOBIL']);
export const plate = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/, 'Invalid license plate');
export const password = z
  .string()
  .min(8)
  .max(72) // bcrypt truncates beyond 72 bytes
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');
export const email = z.email().trim().toLowerCase().max(255);
export const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format');
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
