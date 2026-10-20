import type { Queryable } from '../../common/db/transaction';

export interface WorkshopRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  vehicle_types: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  status_reason: string | null;
  is_open: boolean;
  accepts_emergency: boolean;
  open_time: string;
  close_time: string;
  max_slot_per_hour: number;
  qris_image_path: string | null;
  avg_rating: number;
  total_reviews: number;
  created_at: string;
  closed_weekdays: number[];
  break_start: string | null;
  break_end: string | null;
}

export const WORKSHOP_COLS = `w.id, w.owner_id, w.name, w.description, w.address, w.phone,
  ST_Y(w.location::geometry) AS latitude, ST_X(w.location::geometry) AS longitude,
  w.vehicle_types::text[] AS vehicle_types, w.status, w.status_reason, w.is_open, w.accepts_emergency,
  to_char(w.open_time, 'HH24:MI') AS open_time, to_char(w.close_time, 'HH24:MI') AS close_time,
  w.max_slot_per_hour, w.qris_image_path, w.avg_rating, w.total_reviews, w.created_at,
  w.closed_weekdays::int[] AS closed_weekdays,
  to_char(w.break_start, 'HH24:MI') AS break_start, to_char(w.break_end, 'HH24:MI') AS break_end`;

export interface WorkshopCreate {
  ownerId: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  vehicle_types: string[];
  open_time: string;
  close_time: string;
  max_slot_per_hour: number;
}

export type WorkshopUpdate = Partial<Omit<WorkshopCreate, 'ownerId'>> & {
  is_open?: boolean;
  accepts_emergency?: boolean;
  closed_weekdays?: number[];
  break_start?: string | null;
  break_end?: string | null;
};

/** Whitelisted column map: only these keys can ever reach the SET clause. */
const UPDATABLE: Record<string, string> = {
  name: 'name',
  description: 'description',
  address: 'address',
  phone: 'phone',
  open_time: 'open_time',
  close_time: 'close_time',
  max_slot_per_hour: 'max_slot_per_hour',
  is_open: 'is_open',
  accepts_emergency: 'accepts_emergency',
  break_start: 'break_start',
  break_end: 'break_end',
};

export const workshopRepository = {
  async create(q: Queryable, w: WorkshopCreate) {
    const { rows } = await q.query<WorkshopRow>(
      `WITH ins AS (
         INSERT INTO workshops (owner_id, name, description, address, phone, location, vehicle_types, open_time, close_time, max_slot_per_hour)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, $8::vehicle_type[], $9, $10, $11)
         RETURNING *)
       SELECT ${WORKSHOP_COLS} FROM ins w`,
      [w.ownerId, w.name, w.description ?? null, w.address, w.phone, w.latitude, w.longitude, w.vehicle_types, w.open_time, w.close_time, w.max_slot_per_hour],
    );
    return rows[0];
  },

  async findById(q: Queryable, id: string) {
    const { rows } = await q.query<WorkshopRow>(`SELECT ${WORKSHOP_COLS} FROM workshops w WHERE w.id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findByOwner(q: Queryable, ownerId: string) {
    const { rows } = await q.query<WorkshopRow>(`SELECT ${WORKSHOP_COLS} FROM workshops w WHERE w.owner_id = $1`, [ownerId]);
    return rows[0] ?? null;
  },

  async update(q: Queryable, id: string, patch: WorkshopUpdate) {
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const [key, col] of Object.entries(UPDATABLE)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v === undefined) continue;
      values.push(v);
      sets.push(`${col} = $${values.length}`);
    }
    if (patch.vehicle_types) {
      values.push(patch.vehicle_types);
      sets.push(`vehicle_types = $${values.length}::vehicle_type[]`);
    }
    if (patch.closed_weekdays) {
      values.push(patch.closed_weekdays);
      sets.push(`closed_weekdays = $${values.length}::smallint[]`);
    }
    if (patch.latitude !== undefined && patch.longitude !== undefined) {
      values.push(patch.longitude, patch.latitude);
      sets.push(`location = ST_SetSRID(ST_MakePoint($${values.length - 1}, $${values.length}), 4326)::geography`);
    }
    if (sets.length === 0) return this.findById(q, id);
    const { rows } = await q.query<WorkshopRow>(
      `WITH upd AS (UPDATE workshops SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *)
       SELECT ${WORKSHOP_COLS} FROM upd w`,
      values,
    );
    return rows[0] ?? null;
  },

  async setQris(q: Queryable, id: string, path: string) {
    await q.query('UPDATE workshops SET qris_image_path = $2, updated_at = NOW() WHERE id = $1', [id, path]);
  },

  async listApproved(
    q: Queryable,
    f: {
      lat?: number; lng?: number; radiusMeters?: number; vehicleType?: string; search?: string; sort?: 'distance' | 'rating' | 'recommended';
      /** Item 17: only workshops that can still take a booking in this slot. */
      slot?: { date: string; time: string };
      limit: number; offset: number;
    },
  ) {
    const hasPoint = f.lat !== undefined && f.lng !== undefined;
    // Unrated workshops count as a neutral 3.0, like SOS routing (emergency.logic.ts).
    const rating = `(CASE WHEN w.total_reviews > 0 THEN w.avg_rating ELSE 3 END)`;
    const sort = f.sort ?? (hasPoint ? 'distance' : 'rating');
    const orderBy =
      sort === 'distance' && hasPoint
        ? 'distance_meters ASC'
        : sort === 'recommended' && hasPoint
          ? `(0.6 * GREATEST(0, 1 - distance_meters / $3::float8) + 0.4 * ${rating} / 5) DESC, distance_meters ASC`
          : `w.avg_rating DESC, w.total_reviews DESC, ${hasPoint ? 'distance_meters ASC' : 'w.name ASC'}`;
    // Subquery so ORDER BY expressions can use the distance_meters alias.
    const { rows } = await q.query<WorkshopRow & { distance_meters: number | null }>(
      `SELECT w.* FROM (
         SELECT ${WORKSHOP_COLS},
           CASE WHEN $1::float8 IS NULL THEN NULL
                ELSE ST_Distance(w.location, ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography) END AS distance_meters
         FROM workshops w
         WHERE w.status = 'APPROVED'
           AND ($1::float8 IS NULL OR ST_DWithin(w.location, ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography, $3::float8))
           AND ($4::vehicle_type IS NULL OR $4::vehicle_type = ANY(w.vehicle_types))
           AND ($5::text IS NULL OR w.name ILIKE '%' || $5::text || '%')
           AND ($8::date IS NULL OR (
             w.is_open
             -- seconds since midnight: TIME + interval wraps past 24:00 (23:00 + 1h = 00:00)
             AND EXTRACT(EPOCH FROM $9::time) >= EXTRACT(EPOCH FROM w.open_time)
             AND EXTRACT(EPOCH FROM $9::time) + 3600 <= EXTRACT(EPOCH FROM w.close_time)
             AND NOT (EXTRACT(DOW FROM $8::date)::smallint = ANY(w.closed_weekdays))
             AND NOT EXISTS (SELECT 1 FROM workshop_holidays h WHERE h.workshop_id = w.id AND h.holiday_date = $8::date)
             AND (w.break_start IS NULL OR NOT (EXTRACT(EPOCH FROM $9::time) < EXTRACT(EPOCH FROM w.break_end)
                                               AND EXTRACT(EPOCH FROM $9::time) + 3600 > EXTRACT(EPOCH FROM w.break_start)))
             AND COALESCE((SELECT q.max_slot_per_hour - q.current_booked FROM workshop_quotas q
                           WHERE q.workshop_id = w.id AND q.slot_date = $8::date AND q.slot_time = $9::time), w.max_slot_per_hour) > 0))
       ) w
       ORDER BY ${orderBy}
       LIMIT $6 OFFSET $7`,
      [hasPoint ? f.lat : null, hasPoint ? f.lng : null, f.radiusMeters ?? 20_000, f.vehicleType ?? null, f.search ?? null, f.limit, f.offset,
       f.slot?.date ?? null, f.slot?.time ?? null],
    );
    return rows;
  },
};

// ---------- Photos ----------
export const MAX_WORKSHOP_PHOTOS = 10;
export const photoRepository = {
  async list(q: Queryable, workshopId: string) {
    const { rows } = await q.query<{ id: string; path: string; is_cover: boolean; sort_order: number; created_at: string }>(
      `SELECT id, path, is_cover, sort_order, created_at FROM workshop_photos WHERE workshop_id = $1 ORDER BY is_cover DESC, sort_order, created_at`,
      [workshopId],
    );
    return rows;
  },
  async count(q: Queryable, workshopId: string) {
    const { rows } = await q.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM workshop_photos WHERE workshop_id = $1`, [workshopId]);
    return rows[0].n;
  },
  async add(q: Queryable, workshopId: string, path: string, isCover: boolean) {
    const { rows } = await q.query<{ id: string; is_cover: boolean; sort_order: number }>(
      `INSERT INTO workshop_photos (workshop_id, path, is_cover, sort_order)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM workshop_photos WHERE workshop_id = $1), 0))
       RETURNING id, is_cover, sort_order`,
      [workshopId, path, isCover],
    );
    return rows[0];
  },
  async find(q: Queryable, workshopId: string, id: string) {
    const { rows } = await q.query<{ id: string; path: string; is_cover: boolean }>(
      `SELECT id, path, is_cover FROM workshop_photos WHERE id = $1 AND workshop_id = $2`,
      [id, workshopId],
    );
    return rows[0] ?? null;
  },
  async remove(q: Queryable, workshopId: string, id: string) {
    const { rows } = await q.query<{ path: string; is_cover: boolean }>(
      `DELETE FROM workshop_photos WHERE id = $1 AND workshop_id = $2 RETURNING path, is_cover`,
      [id, workshopId],
    );
    return rows[0] ?? null;
  },
  /** Exactly one cover: the chosen photo, or the oldest remaining one after the cover was deleted. */
  async setCover(q: Queryable, workshopId: string, id: string | null) {
    await q.query(`UPDATE workshop_photos SET is_cover = FALSE WHERE workshop_id = $1 AND is_cover`, [workshopId]);
    await q.query(
      `UPDATE workshop_photos SET is_cover = TRUE
       WHERE id = COALESCE($2::uuid, (SELECT id FROM workshop_photos WHERE workshop_id = $1 ORDER BY sort_order, created_at LIMIT 1))
         AND workshop_id = $1`,
      [workshopId, id],
    );
  },
};

/** Public URL of a stored photo (served by GET /workshops/:id/photos/:photoId). */
export const photoUrl = (workshopId: string, photoId: string) => `/workshops/${workshopId}/photos/${photoId}`;

// ---------- Holidays ----------
export const holidayRepository = {
  async list(q: Queryable, workshopId: string, from?: string, to?: string) {
    const { rows } = await q.query<{ id: string; holiday_date: string; note: string | null }>(
      `SELECT id, to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date, note FROM workshop_holidays
       WHERE workshop_id = $1 AND ($2::date IS NULL OR holiday_date >= $2) AND ($3::date IS NULL OR holiday_date <= $3)
       ORDER BY holiday_date`,
      [workshopId, from ?? null, to ?? null],
    );
    return rows;
  },
  async dates(q: Queryable, workshopId: string, from: string, to: string) {
    return (await this.list(q, workshopId, from, to)).map((h) => h.holiday_date);
  },
  async add(q: Queryable, workshopId: string, date: string, note?: string) {
    const { rows } = await q.query<{ id: string; holiday_date: string; note: string | null }>(
      `INSERT INTO workshop_holidays (workshop_id, holiday_date, note) VALUES ($1, $2, $3)
       ON CONFLICT (workshop_id, holiday_date) DO UPDATE SET note = EXCLUDED.note
       RETURNING id, to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date, note`,
      [workshopId, date, note ?? null],
    );
    return rows[0];
  },
  async remove(q: Queryable, workshopId: string, id: string) {
    const { rowCount } = await q.query(`DELETE FROM workshop_holidays WHERE id = $1 AND workshop_id = $2`, [id, workshopId]);
    return (rowCount ?? 0) > 0;
  },
};

/** The schedule shape booking.logic expects, from a workshop row (+ holidays in the relevant range). */
export function scheduleOf(w: Pick<WorkshopRow, 'closed_weekdays' | 'break_start' | 'break_end'>, holidays: string[] = []) {
  return { closedWeekdays: w.closed_weekdays ?? [], breakStart: w.break_start, breakEnd: w.break_end, holidays };
}

// ---------- Services ----------
export interface ServiceRow {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  vehicle_type: string;
  is_active: boolean;
}
const SERVICE_COLS = 'id, workshop_id, name, description, price, duration_minutes, vehicle_type, is_active';

export const serviceRepository = {
  async list(q: Queryable, workshopId: string, activeOnly: boolean) {
    const { rows } = await q.query<ServiceRow>(
      `SELECT ${SERVICE_COLS} FROM services WHERE workshop_id = $1 AND deleted_at IS NULL AND ($2::bool = FALSE OR is_active)
       ORDER BY vehicle_type, name`,
      [workshopId, activeOnly],
    );
    return rows;
  },
  async findById(q: Queryable, id: string) {
    const { rows } = await q.query<ServiceRow>(`SELECT ${SERVICE_COLS} FROM services WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },
  async create(q: Queryable, workshopId: string, s: { name: string; description?: string; price: number; duration_minutes: number; vehicle_type: string }) {
    const { rows } = await q.query<ServiceRow>(
      `INSERT INTO services (workshop_id, name, description, price, duration_minutes, vehicle_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${SERVICE_COLS}`,
      [workshopId, s.name, s.description ?? null, s.price, s.duration_minutes, s.vehicle_type],
    );
    return rows[0];
  },
  /** Scoped by workshop_id so an owner can never touch another workshop's rows (BOLA). */
  async update(q: Queryable, workshopId: string, id: string, s: Partial<Omit<ServiceRow, 'id' | 'workshop_id'>>) {
    const { rows } = await q.query<ServiceRow>(
      `UPDATE services SET
         name = COALESCE($3, name), description = COALESCE($4, description), price = COALESCE($5, price),
         duration_minutes = COALESCE($6, duration_minutes), vehicle_type = COALESCE($7::vehicle_type, vehicle_type),
         is_active = COALESCE($8, is_active), updated_at = NOW()
       WHERE id = $1 AND workshop_id = $2 AND deleted_at IS NULL RETURNING ${SERVICE_COLS}`,
      [id, workshopId, s.name ?? null, s.description ?? null, s.price ?? null, s.duration_minutes ?? null, s.vehicle_type ?? null, s.is_active ?? null],
    );
    return rows[0] ?? null;
  },
  /** Soft delete: hidden everywhere and no longer bookable; existing bookings keep their reference. */
  async softDelete(q: Queryable, workshopId: string, id: string) {
    const { rows } = await q.query<{ id: string }>(
      `UPDATE services SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND workshop_id = $2 AND deleted_at IS NULL RETURNING id`,
      [id, workshopId],
    );
    return rows[0] ?? null;
  },
};

// ---------- Mechanics ----------
export interface MechanicRow {
  id: string;
  workshop_id: string;
  name: string;
  phone: string | null;
  specializations: string[];
  is_active: boolean;
  avg_rating: number;
  total_reviews: number;
  has_photo: boolean;
}
const MECHANIC_COLS = 'id, workshop_id, name, phone, specializations, is_active, avg_rating, total_reviews, (photo_path IS NOT NULL) AS has_photo';

export const mechanicRepository = {
  async list(q: Queryable, workshopId: string, activeOnly: boolean) {
    const { rows } = await q.query<MechanicRow>(
      `SELECT ${MECHANIC_COLS} FROM mechanics WHERE workshop_id = $1 AND ($2::bool = FALSE OR is_active)
       ORDER BY avg_rating DESC, name`,
      [workshopId, activeOnly],
    );
    return rows;
  },
  async create(q: Queryable, workshopId: string, m: { name: string; phone?: string; specializations: string[] }) {
    const { rows } = await q.query<MechanicRow>(
      `INSERT INTO mechanics (workshop_id, name, phone, specializations) VALUES ($1, $2, $3, $4) RETURNING ${MECHANIC_COLS}`,
      [workshopId, m.name, m.phone ?? null, m.specializations],
    );
    return rows[0];
  },
  async update(q: Queryable, workshopId: string, id: string, m: { name?: string; phone?: string; specializations?: string[]; is_active?: boolean }) {
    const { rows } = await q.query<MechanicRow>(
      `UPDATE mechanics SET name = COALESCE($3, name), phone = COALESCE($4, phone),
         specializations = COALESCE($5, specializations), is_active = COALESCE($6, is_active), updated_at = NOW()
       WHERE id = $1 AND workshop_id = $2 RETURNING ${MECHANIC_COLS}`,
      [id, workshopId, m.name ?? null, m.phone ?? null, m.specializations ?? null, m.is_active ?? null],
    );
    return rows[0] ?? null;
  },
  async photoPath(q: Queryable, workshopId: string, id: string) {
    const { rows } = await q.query<{ photo_path: string | null }>(`SELECT photo_path FROM mechanics WHERE id = $1 AND workshop_id = $2`, [id, workshopId]);
    return rows[0] ?? null;
  },
  async setPhoto(q: Queryable, workshopId: string, id: string, path: string | null) {
    const { rows } = await q.query<{ old: string | null }>(
      `UPDATE mechanics m SET photo_path = $3, updated_at = NOW() FROM (SELECT photo_path AS old FROM mechanics WHERE id = $1 AND workshop_id = $2) prev
       WHERE m.id = $1 AND m.workshop_id = $2 RETURNING prev.old`,
      [id, workshopId, path],
    );
    return rows[0] ?? null;
  },
};
