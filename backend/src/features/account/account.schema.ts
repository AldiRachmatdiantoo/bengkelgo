import { z } from 'zod';
import { email, password, phoneId, safeText } from '../../common/middlewares/validate';

/** Own name and WhatsApp number (same rules as sign-up); at least one of them. */
export const updateProfileSchema = z
  .object({
    name: safeText(100).pipe(z.string().min(2)).optional(),
    phone: phoneId.optional(),
  })
  .refine((b) => b.name !== undefined || b.phone !== undefined, { message: 'Send name and/or phone' });

/** `current_password` is required when the account already has a password (not for Google-only accounts). */
export const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(72).optional(),
  new_password: password,
});

/** New email; the current password is asked for when the account has one. */
export const emailChangeSchema = z.object({
  email,
  password: z.string().min(1).max(72).optional(),
});

/** Password when the account has one, otherwise the word HAPUS typed by hand. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(72).optional(),
  confirm: z.string().trim().max(10).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailChangeInput = z.infer<typeof emailChangeSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
