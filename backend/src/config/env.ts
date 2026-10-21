import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: bool,
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: bool,
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default(''),

  // Booking abuse guards: unfinished bookings per customer, and booking attempts per customer per hour.
  BOOKING_MAX_ACTIVE: z.coerce.number().int().positive().default(3),
  BOOKING_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),
  EMERGENCY_RADIUS_METERS: z.coerce.number().positive().default(5000),
  EMERGENCY_RESPONSE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  EMERGENCY_MAX_ROUTING_ATTEMPTS: z.coerce.number().int().positive().default(5),

  /** Where uploaded images live: `local` (UPLOAD_DIR on disk) or `supabase` (private Storage bucket). */
  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  SUPABASE_URL: z.string().optional().default(''),
  /** Server-only secret (Supabase → Project Settings → API keys); bypasses RLS, never send it to the browser. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_BUCKET: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  // iPhone HEIC photos are accepted up to this size, then converted to a JPEG within MAX_UPLOAD_BYTES.
  MAX_HEIC_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // Server-side HEIC conversion is refused above this size (decoding needs ~30 MB per megapixel); 0 = off.
  HEIC_MAX_MEGAPIXELS: z.coerce.number().positive().default(13),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  /** Gmail API instead of SMTP (when set): OAuth client + refresh token of the sending account, scope gmail.send. */
  GMAIL_CLIENT_ID: z.string().optional().default(''),
  GMAIL_CLIENT_SECRET: z.string().optional().default(''),
  GMAIL_REFRESH_TOKEN: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Bengkel App <no-reply@bengkelapp.com>'),
  /** Public address of the web app, used for links in emails. */
  APP_URL: z.string().url().default('http://localhost:5173'),

  ENABLE_CRON: bool,
  REMINDER_CRON: z.string().default('0 8-20 * * *'),
  CRON_TIMEZONE: z.string().default('Asia/Jakarta'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
  process.exit(1);
}

const e = parsed.data;
if (e.STORAGE_DRIVER === 'supabase' && !(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY)) {
  // eslint-disable-next-line no-console
  console.error('STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (e.GMAIL_REFRESH_TOKEN && !(e.GMAIL_CLIENT_ID && e.GMAIL_CLIENT_SECRET)) {
  // eslint-disable-next-line no-console
  console.error('GMAIL_REFRESH_TOKEN requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET');
  process.exit(1);
}
if (e.COOKIE_SAMESITE === 'none' && !e.COOKIE_SECURE) {
  // eslint-disable-next-line no-console
  console.error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  process.exit(1);
}

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  corsOrigins: e.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  googleEnabled: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
};
