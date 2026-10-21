import { z } from 'zod';
import { email, latitude, longitude, password, phoneId, safeText, timeHHmm, vehicleType } from '../../common/middlewares/validate';

export const registerCustomerSchema = z.object({
  name: safeText(100).pipe(z.string().min(2)),
  email,
  phone: phoneId,
  password,
});

export const registerWorkshopSchema = z.object({
  owner: z.object({
    name: safeText(100).pipe(z.string().min(2)),
    email,
    phone: phoneId,
    password,
  }),
  workshop: z
    .object({
      name: safeText(150).pipe(z.string().min(3)),
      description: safeText(2000).optional(),
      address: safeText(500).pipe(z.string().min(5)),
      phone: phoneId,
      latitude,
      longitude,
      vehicle_types: z.array(vehicleType).min(1).max(2).default(['MOTOR', 'MOBIL']),
      open_time: timeHHmm.default('08:00'),
      close_time: timeHHmm.default('17:00'),
      max_slot_per_hour: z.coerce.number().int().min(1).max(100).default(3),
    })
    .refine((w) => w.open_time < w.close_time, { message: 'open_time must be before close_time', path: ['close_time'] }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export const googleSchema = z.object({
  code: z.string().min(10).max(2048),
  code_verifier: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9\-._~]+$/, 'Invalid PKCE code_verifier'),
});

export const guestSchema = z.object({
  name: safeText(100).pipe(z.string().min(2)),
  whatsapp: phoneId,
  latitude,
  longitude,
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(20).max(256).optional(),
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type RegisterWorkshopInput = z.infer<typeof registerWorkshopSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
export type GuestInput = z.infer<typeof guestSchema>;

export const verifyEmailSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
