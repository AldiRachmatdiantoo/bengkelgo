import type { Queryable } from '../../common/db/transaction';
import type { Candidate } from './emergency.logic';

export interface ScanRow extends Candidate {
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  avg_rating: number;
  vehicle_types: string[];
}

export interface PendingEmergency {
  id: string;
  workshop_id: string | null;
  vehicle_type: string;
  latitude: number;
  longitude: number;
  routing_attempts: number;
  attempted_workshop_ids: string[];
  response_deadline: Date | null;
}

/** Mechanic is busy while on an accepted / in-progress emergency job, or while working on a booking right now. */
const BUSY_MECHANIC = `EXISTS (SELECT 1 FROM orders bo WHERE bo.mechanic_id = m.id
  AND ((bo.type = 'EMERGENCY' AND bo.status IN ('ACCEPTED', 'IN_PROGRESS')) OR (bo.type = 'BOOKING' AND bo.status = 'IN_PROGRESS')))`;

export const emergencyRepository = {
  /**
   * FR-EME-01: PostGIS ST_DWithin on geography (metres) — uses idx_workshops_location_gist.
   * Only APPROVED, open, emergency-enabled workshops serving the vehicle type are returned.
   */
  async scan(q: Queryable, p: { lat: number; lng: number; radiusMeters: number; vehicleType?: string | null; limit?: number }) {
    const { rows } = await q.query<ScanRow>(
      `WITH origin AS (SELECT ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography AS g)
       SELECT w.id, w.name, w.address, w.phone, w.avg_rating, w.vehicle_types::text[] AS vehicle_types,
              ST_Y(w.location::geometry) AS latitude, ST_X(w.location::geometry) AS longitude,
              ROUND(ST_Distance(w.location, origin.g)::numeric, 2) AS distance_meters,
              mk.top_mechanic_rating, mk.rated_mechanics, mk.available_mechanics
       FROM workshops w
       CROSS JOIN origin
       CROSS JOIN LATERAL (
         SELECT COALESCE(MAX(m.avg_rating) FILTER (WHERE m.total_reviews > 0), 0) AS top_mechanic_rating,
                COUNT(*) FILTER (WHERE m.total_reviews > 0)::int AS rated_mechanics,
                COUNT(*) FILTER (WHERE NOT ${BUSY_MECHANIC})::int AS available_mechanics
         FROM mechanics m WHERE m.workshop_id = w.id AND m.is_active
       ) mk
       WHERE w.status = 'APPROVED' AND w.is_open AND w.accepts_emergency
         AND ST_DWithin(w.location, origin.g, $3::float8)
         AND ($4::vehicle_type IS NULL OR $4::vehicle_type = ANY(w.vehicle_types))
       ORDER BY distance_meters ASC
       LIMIT $5`,
      [p.lat, p.lng, p.radiusMeters, p.vehicleType ?? null, p.limit ?? 50],
    );
    return rows;
  },

  async hasActiveEmergency(q: Queryable, customerId: string) {
    const { rows } = await q.query(
      `SELECT 1 FROM orders WHERE customer_id = $1 AND type = 'EMERGENCY' AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS') LIMIT 1`,
      [customerId],
    );
    return rows.length > 0;
  },

  async insertDetails(
    q: Queryable,
    d: {
      orderId: string; lat: number; lng: number; addressNote?: string; problem: string; distance: number; timeoutSeconds: number; workshopId: string;
      priceMin?: number; priceMax?: number; problemCategory?: string;
    },
  ) {
    await q.query(
      `INSERT INTO emergency_details (order_id, location, address_note, problem_description, distance_meters, response_deadline, routing_attempts, attempted_workshop_ids, price_min, price_max, problem_category)
       VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4, $5, $6, NOW() + make_interval(secs => $7), 1, ARRAY[$8::uuid], $9, $10, $11)`,
      [d.orderId, d.lat, d.lng, d.addressNote ?? null, d.problem, d.distance, d.timeoutSeconds, d.workshopId, d.priceMin ?? null, d.priceMax ?? null, d.problemCategory ?? null],
    );
  },

  async findPendingForUpdate(q: Queryable, orderId: string) {
    const { rows } = await q.query<PendingEmergency & { status: string; type: string; customer_id: string }>(
      `SELECT o.id, o.status, o.type, o.customer_id, o.workshop_id, o.vehicle_type,
              ST_Y(e.location::geometry) AS latitude, ST_X(e.location::geometry) AS longitude,
              e.routing_attempts, e.attempted_workshop_ids::text[] AS attempted_workshop_ids, e.response_deadline
       FROM orders o JOIN emergency_details e ON e.order_id = o.id
       WHERE o.id = $1
       FOR UPDATE OF o, e`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  /** PBI-205: claims timed-out PENDING emergencies; SKIP LOCKED makes it safe across replicas. */
  async claimExpired(q: Queryable, limit: number) {
    const { rows } = await q.query<PendingEmergency>(
      `SELECT o.id, o.workshop_id, o.vehicle_type,
              ST_Y(e.location::geometry) AS latitude, ST_X(e.location::geometry) AS longitude,
              e.routing_attempts, e.attempted_workshop_ids::text[] AS attempted_workshop_ids, e.response_deadline
       FROM orders o JOIN emergency_details e ON e.order_id = o.id
       WHERE o.type = 'EMERGENCY' AND o.status = 'PENDING' AND e.response_deadline < NOW()
       ORDER BY e.response_deadline ASC
       LIMIT $1
       FOR UPDATE OF o, e SKIP LOCKED`,
      [limit],
    );
    return rows;
  },

  async reassign(q: Queryable, orderId: string, workshopId: string, distance: number, timeoutSeconds: number) {
    await q.query(`UPDATE orders SET workshop_id = $2, updated_at = NOW() WHERE id = $1`, [orderId, workshopId]);
    await q.query(
      `UPDATE emergency_details SET routing_attempts = routing_attempts + 1,
         attempted_workshop_ids = array_append(attempted_workshop_ids, $2::uuid),
         distance_meters = $3, response_deadline = NOW() + make_interval(secs => $4)
       WHERE order_id = $1`,
      [orderId, workshopId, distance, timeoutSeconds],
    );
  },

  async markUnassigned(q: Queryable, orderId: string) {
    await q.query(`UPDATE orders SET status = 'UNASSIGNED', workshop_id = NULL, updated_at = NOW() WHERE id = $1`, [orderId]);
    await q.query(`UPDATE emergency_details SET response_deadline = NULL WHERE order_id = $1`, [orderId]);
  },

  async markResponded(q: Queryable, orderId: string) {
    await q.query(`UPDATE emergency_details SET responded_at = NOW(), response_deadline = NULL WHERE order_id = $1`, [orderId]);
  },

  /** The owner's chosen mechanic, locked; null when it isn't theirs or is inactive. `busy` = on another job. */
  async lockChosenMechanic(q: Queryable, workshopId: string, mechanicId: string) {
    const { rows } = await q.query<{ id: string; name: string; phone: string | null; busy: boolean }>(
      `SELECT m.id, m.name, m.phone, ${BUSY_MECHANIC} AS busy FROM mechanics m
       WHERE m.id = $2 AND m.workshop_id = $1 AND m.is_active
       FOR UPDATE`,
      [workshopId, mechanicId],
    );
    return rows[0] ?? null;
  },

  /** Best free mechanic for an emergency dispatch; SKIP LOCKED avoids double-dispatching concurrently. */
  async pickFreeMechanic(q: Queryable, workshopId: string) {
    const { rows } = await q.query<{ id: string; name: string; phone: string | null }>(
      `SELECT m.id, m.name, m.phone FROM mechanics m
       WHERE m.workshop_id = $1 AND m.is_active AND NOT ${BUSY_MECHANIC}
       ORDER BY m.avg_rating DESC, m.id
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [workshopId],
    );
    return rows[0] ?? null;
  },
};
