import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { getRedis } from '../../config/redis';
import { db } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { addDays, localNow } from '../../common/utils/time';
import { schedulerInfo } from '../../jobs/scheduler';
import { workshopRepository } from '../workshop/workshop.repository';

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
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM workshops WHERE status = 'APPROVED') AS active_workshops,
         (SELECT COUNT(*)::int FROM mechanics m JOIN workshops w ON w.id = m.workshop_id WHERE m.is_active AND w.status = 'APPROVED') AS active_mechanics,
         (SELECT COUNT(*)::int FROM users WHERE role IN ('CUSTOMER', 'GUEST') AND is_active) AS total_customers,
         (SELECT COUNT(*)::int FROM orders WHERE status = 'COMPLETED') AS completed_orders,
         (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews) AS avg_platform_rating,
         (SELECT COUNT(*)::int FROM reviews) AS total_reviews,
         (SELECT ROUND((AVG(EXTRACT(EPOCH FROM (e.responded_at - o.created_at))) / 60)::numeric, 1)
            FROM emergency_details e JOIN orders o ON o.id = e.order_id
            WHERE e.responded_at IS NOT NULL AND o.created_at > NOW() - interval '90 days') AS avg_emergency_response_minutes`,
    );
    publicCache = { at: Date.now(), data: rows[0] };
    return rows[0];
  },

  /** Item 13: one business day of the owner's workshop. */
  async ownerStats(ownerId: string, date?: string) {
    const w = await workshopRepository.findByOwner(db, ownerId);
    if (!w) throw AppError.notFound('You have no registered workshop', 'WORKSHOP_NOT_FOUND');
    const day = date ?? localNow().date;
    const { rows } = await db.query(
      `WITH b AS (
         SELECT o.status FROM orders o JOIN booking_details bd ON bd.order_id = o.id WHERE o.workshop_id = $1 AND bd.booking_date = $2::date),
       e AS (
         SELECT o.status FROM orders o WHERE o.workshop_id = $1 AND o.type = 'EMERGENCY' AND (o.created_at AT TIME ZONE $3::text)::date = $2::date),
       q AS (
         SELECT COALESCE(SUM(current_booked), 0)::int AS booked, COALESCE(SUM(max_slot_per_hour), 0)::int AS capacity
         FROM workshop_quotas WHERE workshop_id = $1 AND slot_date = $2::date)
       SELECT
         (SELECT COUNT(*)::int FROM b WHERE status <> 'CANCELLED') AS bookings,
         (SELECT COUNT(*)::int FROM b WHERE status = 'IN_QUEUE') AS waitlisted,
         (SELECT COUNT(*)::int FROM b WHERE status = 'COMPLETED') AS bookings_completed,
         (SELECT COUNT(*)::int FROM e) AS emergencies,
         (SELECT COUNT(*)::int FROM e WHERE status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED')) AS emergencies_handled,
         (SELECT booked FROM q) AS quota_booked,
         (SELECT capacity FROM q) AS quota_capacity,
         (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t JOIN orders o ON o.id = t.order_id
            WHERE o.workshop_id = $1 AND t.status = 'VERIFIED' AND (t.verified_at AT TIME ZONE $3::text)::date = $2::date) AS verified_revenue,
         (SELECT COUNT(*)::int FROM transactions t JOIN orders o ON o.id = t.order_id
            WHERE o.workshop_id = $1 AND t.status = 'PENDING_VERIFICATION') AS payments_to_verify,
         (SELECT COUNT(*)::int FROM mechanics WHERE workshop_id = $1 AND is_active) AS active_mechanics`,
      [w.id, day, TZ()],
    );
    const s = rows[0];
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
    const { rows } = await db.query(
      `SELECT
         (SELECT json_object_agg(status, n) FROM (SELECT status, COUNT(*)::int AS n FROM workshops GROUP BY status) x) AS workshops_by_status,
         (SELECT json_object_agg(role, n) FROM (SELECT role, COUNT(*)::int AS n FROM users WHERE is_active GROUP BY role) x) AS users_by_role,
         (SELECT COUNT(*)::int FROM orders WHERE (created_at AT TIME ZONE $2::text)::date = $1::date) AS orders_today,
         (SELECT COUNT(*)::int FROM orders WHERE status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS') AND type = 'EMERGENCY') AS live_emergencies,
         (SELECT COUNT(*)::int FROM transactions WHERE status = 'PENDING_VERIFICATION') AS payments_to_verify,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'VERIFIED' AND verified_at >= (($3::date)::timestamp AT TIME ZONE $2::text)) AS verified_revenue_30d,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'REFUNDED' AND refunded_at >= (($3::date)::timestamp AT TIME ZONE $2::text)) AS refunded_30d`,
      [today, TZ(), addDays(today, -30)],
    );
    return { date: today, ...rows[0], workshops_by_status: rows[0].workshops_by_status ?? {}, users_by_role: rows[0].users_by_role ?? {} };
  },

  /** Item 14: one box to find workshops, orders, invoices/transfer references and users. */
  async search(q: string) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const [workshops, orders, payments, users] = await Promise.all([
      db.query(`SELECT id, name, status, phone FROM workshops WHERE name ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 10`, [like]),
      db.query(
        `SELECT o.id, o.order_number, o.type, o.status, o.created_at, w.name AS workshop_name
         FROM orders o LEFT JOIN workshops w ON w.id = o.workshop_id WHERE o.order_number ILIKE $1 ORDER BY o.created_at DESC LIMIT 10`,
        [like],
      ),
      db.query(
        `SELECT t.order_id, o.order_number, t.invoice_number, t.payer_reference, t.payer_name, t.amount, t.status
         FROM transactions t JOIN orders o ON o.id = t.order_id
         WHERE t.invoice_number ILIKE $1 OR t.payer_reference ILIKE $1 OR t.payer_name ILIKE $1 ORDER BY t.updated_at DESC LIMIT 10`,
        [like],
      ),
      db.query(`SELECT id, name, email, role, is_active FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 10`, [like]),
    ]);
    return { query: q, workshops: workshops.rows, orders: orders.rows, payments: payments.rows, users: users.rows };
  },

  /** Item 12: read the audit trail with filters. */
  async auditLogs(f: { entity?: string; entity_id?: string; actor_id?: string; action?: string; from?: string; to?: string; page: number; limit: number }) {
    const { rows } = await db.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.actor_id, a.actor_role, u.name AS actor_name, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE ($1::text IS NULL OR a.entity = $1) AND ($2::uuid IS NULL OR a.entity_id = $2) AND ($3::uuid IS NULL OR a.actor_id = $3)
         AND ($4::text IS NULL OR a.action = $4)
         AND ($5::date IS NULL OR a.created_at >= (($5::date)::timestamp AT TIME ZONE $9::text))
         AND ($6::date IS NULL OR a.created_at < (($6::date + 1)::timestamp AT TIME ZONE $9::text))
       ORDER BY a.id DESC LIMIT $7 OFFSET $8`,
      [f.entity ?? null, f.entity_id ?? null, f.actor_id ?? null, f.action ?? null, f.from ?? null, f.to ?? null, f.limit, (f.page - 1) * f.limit, TZ()],
    );
    return rows;
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
      timed(() => db.query('SELECT 1')),
      timed(async () => (await db.query<{ v: string }>('SELECT postgis_lib_version() AS v')).rows[0].v),
      timed(async () => (await db.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name)),
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
