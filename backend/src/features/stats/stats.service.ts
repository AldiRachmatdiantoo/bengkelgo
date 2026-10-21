import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { getRedis } from '../../config/redis';
import { db } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { addDays, localNow } from '../../common/utils/time';
import { schedulerInfo } from '../../jobs/scheduler';
import { workshopRepository } from '../workshop/workshop.repository';
import { statsRepository } from './stats.repository';

const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')).version as string;
  } catch {
    return 'unknown';
  }
})();

/** Tiny per-instance cache for the public numbers (they are shown on the landing page). */
let publicCache: { at: number; data: unknown } | null = null;
const PUBLIC_TTL_MS = 5 * 60_000;

const TZ = () => env.CRON_TIMEZONE;

export const statsService = {
  /** Item 13: real platform numbers for the landing page (no personal data). */
  async publicStats() {
    if (publicCache && Date.now() - publicCache.at < PUBLIC_TTL_MS) return publicCache.data;
    const row = await statsRepository.publicNumbers(db);
    publicCache = { at: Date.now(), data: row };
    return row;
  },

  /** Item 13: one business day of the owner's workshop. */
  async ownerStats(ownerId: string, date?: string) {
    const w = await workshopRepository.findByOwner(db, ownerId);
    if (!w) throw AppError.notFound('You have no registered workshop', 'WORKSHOP_NOT_FOUND');
    const day = date ?? localNow().date;
    const s = await statsRepository.workshopDay(db, w.id, day, TZ());
    return {
      date: day,
      ...s,
      quota_utilization: s.quota_capacity > 0 ? Number((s.quota_booked / s.quota_capacity).toFixed(3)) : null,
      avg_rating: w.avg_rating,
      total_reviews: w.total_reviews,
    };
  },

  /** Item 13: platform overview for the admin dashboard. */
  async adminStats() {
    const today = localNow().date;
    const o = await statsRepository.platformOverview(db, today, TZ(), addDays(today, -30));
    return { date: today, ...o, workshops_by_status: o.workshops_by_status ?? {}, users_by_role: o.users_by_role ?? {} };
  },

  /** Item 14: one box to find workshops, orders, invoices/transfer references and users. */
  async search(q: string) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return { query: q, ...(await statsRepository.search(db, like)) };
  },

  /** Item 12: read the audit trail with filters. */
  async auditLogs(f: { entity?: string; entity_id?: string; actor_id?: string; action?: string; from?: string; to?: string; page: number; limit: number }) {
    return statsRepository.auditLogs(
      db,
      { entity: f.entity ?? null, entityId: f.entity_id ?? null, actorId: f.actor_id ?? null, action: f.action ?? null, from: f.from ?? null, to: f.to ?? null, limit: f.limit, offset: (f.page - 1) * f.limit },
      TZ(),
    );
  },

  /** Item 15: health of the pieces the platform depends on. Never throws: each part reports itself. */
  async health() {
    const timed = async <T>(fn: () => Promise<T>) => {
      const t = process.hrtime.bigint();
      try {
        const value = await fn();
        return { ok: true as const, latency_ms: Number((process.hrtime.bigint() - t) / 1_000_000n), value };
      } catch (err) {
        return { ok: false as const, latency_ms: Number((process.hrtime.bigint() - t) / 1_000_000n), error: (err as Error).message };
      }
    };
    const [database, postgis, migrations, redis] = await Promise.all([
      timed(() => statsRepository.ping(db)),
      timed(() => statsRepository.postgisVersion(db)),
      timed(() => statsRepository.appliedMigrations(db)),
      timed(async () => {
        const client = getRedis();
        if (!client) return 'not configured (in-memory rate limiter)';
        return client.ping();
      }),
    ]);
    const strip = <T extends { value?: unknown }>({ value: _v, ...rest }: T) => rest;
    return {
      status: database.ok && (redis.ok || !getRedis()) ? 'ok' : 'degraded',
      version: VERSION,
      node: process.version,
      uptime_seconds: Math.round(process.uptime()),
      database: strip(database),
      postgis: { ...strip(postgis), version: postgis.ok ? postgis.value : null },
      migrations: migrations.ok ? migrations.value : [],
      redis: { ...strip(redis), detail: redis.ok ? redis.value : null },
      scheduler: schedulerInfo(),
    };
  },
};
