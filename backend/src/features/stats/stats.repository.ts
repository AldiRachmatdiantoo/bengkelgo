import type { Queryable } from '../../common/db/transaction';

/** Read-only aggregate queries for the public, owner and admin dashboards (no writes here). */
export const statsRepository = {
  /** Platform numbers for the landing page (no personal data). */
  async publicNumbers(q: Queryable) {
    const { rows } = await q.query(
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
    return rows[0];
  },

  /** One business day (`day`, in time zone `tz`) of a workshop. */
  async workshopDay(q: Queryable, workshopId: string, day: string, tz: string) {
    const { rows } = await q.query(
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
      [workshopId, day, tz],
    );
    return rows[0];
  },

  /** Platform overview: today's orders, live SOS, money verified/refunded since `since`. */
  async platformOverview(q: Queryable, today: string, tz: string, since: string) {
    const { rows } = await q.query(
      `SELECT
         (SELECT json_object_agg(status, n) FROM (SELECT status, COUNT(*)::int AS n FROM workshops GROUP BY status) x) AS workshops_by_status,
         (SELECT json_object_agg(role, n) FROM (SELECT role, COUNT(*)::int AS n FROM users WHERE is_active GROUP BY role) x) AS users_by_role,
         (SELECT COUNT(*)::int FROM orders WHERE (created_at AT TIME ZONE $2::text)::date = $1::date) AS orders_today,
         (SELECT COUNT(*)::int FROM orders WHERE status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS') AND type = 'EMERGENCY') AS live_emergencies,
         (SELECT COUNT(*)::int FROM transactions WHERE status = 'PENDING_VERIFICATION') AS payments_to_verify,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'VERIFIED' AND verified_at >= (($3::date)::timestamp AT TIME ZONE $2::text)) AS verified_revenue_30d,
         (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'REFUNDED' AND refunded_at >= (($3::date)::timestamp AT TIME ZONE $2::text)) AS refunded_30d`,
      [today, tz, since],
    );
    return rows[0];
  },

  /** Admin search box; `like` is an already-escaped ILIKE pattern. */
  async search(q: Queryable, like: string) {
    const [workshops, orders, payments, users] = await Promise.all([
      q.query(`SELECT id, name, status, phone FROM workshops WHERE name ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 10`, [like]),
      q.query(
        `SELECT o.id, o.order_number, o.type, o.status, o.created_at, w.name AS workshop_name
         FROM orders o LEFT JOIN workshops w ON w.id = o.workshop_id WHERE o.order_number ILIKE $1 ORDER BY o.created_at DESC LIMIT 10`,
        [like],
      ),
      q.query(
        `SELECT t.order_id, o.order_number, t.invoice_number, t.payer_reference, t.payer_name, t.amount, t.status
         FROM transactions t JOIN orders o ON o.id = t.order_id
         WHERE t.invoice_number ILIKE $1 OR t.payer_reference ILIKE $1 OR t.payer_name ILIKE $1 ORDER BY t.updated_at DESC LIMIT 10`,
        [like],
      ),
      q.query(`SELECT id, name, email, role, is_active FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 ORDER BY name LIMIT 10`, [like]),
    ]);
    return { workshops: workshops.rows, orders: orders.rows, payments: payments.rows, users: users.rows };
  },

  async auditLogs(
    q: Queryable,
    f: { entity: string | null; entityId: string | null; actorId: string | null; action: string | null; from: string | null; to: string | null; limit: number; offset: number },
    tz: string,
  ) {
    const { rows } = await q.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.actor_id, a.actor_role, u.name AS actor_name, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       WHERE ($1::text IS NULL OR a.entity = $1) AND ($2::uuid IS NULL OR a.entity_id = $2) AND ($3::uuid IS NULL OR a.actor_id = $3)
         AND ($4::text IS NULL OR a.action = $4)
         AND ($5::date IS NULL OR a.created_at >= (($5::date)::timestamp AT TIME ZONE $9::text))
         AND ($6::date IS NULL OR a.created_at < (($6::date + 1)::timestamp AT TIME ZONE $9::text))
       ORDER BY a.id DESC LIMIT $7 OFFSET $8`,
      [f.entity, f.entityId, f.actorId, f.action, f.from, f.to, f.limit, f.offset, tz],
    );
    return rows;
  },

  async ping(q: Queryable) {
    await q.query('SELECT 1');
  },

  async postgisVersion(q: Queryable) {
    return (await q.query<{ v: string }>('SELECT postgis_lib_version() AS v')).rows[0].v;
  },

  /** Email outbox backlog: still waiting (incl. retries) and given up in the last 7 days. */
  async emailQueue(q: Queryable) {
    const { rows } = await q.query<{ pending: number; retrying: number; failed_7d: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'PENDING' AND attempts > 0)::int AS retrying,
              COUNT(*) FILTER (WHERE status = 'FAILED' AND created_at > NOW() - interval '7 days')::int AS failed_7d
       FROM email_outbox`,
    );
    return rows[0];
  },

  async appliedMigrations(q: Queryable) {
    return (await q.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name);
  },
};
