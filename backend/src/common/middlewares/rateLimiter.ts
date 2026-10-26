import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type Redis from 'ioredis';
import { getRedis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../errors/AppError';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterMs: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number, limit: number, now?: number): Promise<RateLimitResult>;
}

/**
 * Sliding-window-log algorithm executed atomically in Redis (one ZSET per key).
 * Rejected hits are not recorded, so a blocked client regains access exactly when the
 * oldest accepted hit leaves the window.
 */
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, count + 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retry = window
if oldest[2] then retry = tonumber(oldest[2]) + window - now end
return {0, count, retry}
`;

export class RedisSlidingWindowStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowMs: number, limit: number, now = Date.now()): Promise<RateLimitResult> {
    const member = `${now}-${crypto.randomBytes(6).toString('hex')}`;
    const [allowed, count, retry] = (await this.redis.eval(
      SLIDING_WINDOW_LUA, 1, key, now, windowMs, limit, member,
    )) as [number, number, number];
    return { allowed: allowed === 1, count, retryAfterMs: Math.max(0, retry) };
  }
}

/** Same algorithm in-process. Used in tests/dev, and as a fallback if Redis is unreachable. */
export class MemorySlidingWindowStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  async hit(key: string, windowMs: number, limit: number, now = Date.now()): Promise<RateLimitResult> {
    const windowStart = now - windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (list.length < limit) {
      list.push(now);
      this.hits.set(key, list);
      return { allowed: true, count: list.length, retryAfterMs: 0 };
    }
    this.hits.set(key, list);
    return { allowed: false, count: list.length, retryAfterMs: list[0] + windowMs - now };
  }

  reset() {
    this.hits.clear();
  }
}

export const memoryStore = new MemorySlidingWindowStore();

function resolveStore(): RateLimitStore {
  const redis = getRedis();
  return redis ? new RedisSlidingWindowStore(redis) : memoryStore;
}

interface RateLimitOptions {
  name: string;
  windowMs: number;
  limit: number;
  /** Defaults to the client IP (honours `trust proxy` behind NGINX). */
  keyGenerator?: (req: Request) => string;
  store?: RateLimitStore;
  /** Error code sent with the 429 (default RATE_LIMITED). */
  code?: string;
}

export function rateLimit(opts: RateLimitOptions) {
  let store: RateLimitStore | undefined = opts.store;
  return async (req: Request, res: Response, next: NextFunction) => {
    store ??= resolveStore();
    const id = opts.keyGenerator ? opts.keyGenerator(req) : req.ip ?? 'unknown';
    const key = `rl:${opts.name}:${id}`;
    let result: RateLimitResult;
    try {
      result = await store.hit(key, opts.windowMs, opts.limit);
    } catch (err) {
      // Redis outage: degrade to the per-instance memory limiter instead of disabling protection.
      logger.warn({ err: (err as Error).message }, 'Rate limiter store failed, using memory fallback');
      result = await memoryStore.hit(key, opts.windowMs, opts.limit);
    }
    res.setHeader('RateLimit-Limit', String(opts.limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.limit - result.count)));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return next(AppError.tooMany(undefined, opts.code));
    }
    next();
  };
}

// ---------- PRD 6.4 limits ----------
export const emergencyLimiter = rateLimit({ name: 'emergency', windowMs: 60_000, limit: 10 });
export const authLimiter = rateLimit({ name: 'auth', windowMs: 15 * 60_000, limit: 15 });
export const globalLimiter = rateLimit({ name: 'global', windowMs: 60_000, limit: 300 });
/** Place search proxies free OpenStreetMap services; keep one client from exhausting their fair use. */
/**
 * Login attempts per email, on top of the per-IP limit: the client IP comes from X-Forwarded-For, which a
 * request sent straight to the API host (skipping the proxies) can fake, so guessing one account's password
 * must also be capped by the account itself. The email is hashed so the store never holds addresses.
 */
export const loginAccountLimiter = rateLimit({
  name: 'login-account',
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? crypto.createHash('sha256').update(email).digest('hex').slice(0, 32) : req.ip ?? 'unknown';
  },
});
/** Reset-link requests per email (hashed), whether or not the email has an account. */
export const passwordResetAccountLimiter = rateLimit({
  name: 'pw-reset-account',
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? crypto.createHash('sha256').update(email).digest('hex').slice(0, 32) : req.ip ?? 'unknown';
  },
});
/** Email verification: code checks plus resend requests per account (resends are also spaced by the service). */
export const verificationLimiter = rateLimit({
  name: 'email-verify',
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
});
/** Password-checked account changes (change password / email, delete account) per account: caps password guessing. */
export const accountLimiter = rateLimit({
  name: 'account',
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
});
/** Booking attempts per customer account (not per IP: shared networks must not block each other). */
export const bookingLimiter = rateLimit({
  name: 'booking',
  windowMs: 60 * 60_000,
  limit: env.BOOKING_MAX_PER_HOUR,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  code: 'BOOKING_RATE_LIMITED',
});
export const geocodeLimiter = rateLimit({ name: 'geocode', windowMs: 60_000, limit: 40 });
