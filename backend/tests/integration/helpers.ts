import { pool } from '../../src/config/database';
import { runMigrations } from '../../src/db/migrate';
import { signAccessToken, type UserRole } from '../../src/common/utils/jwt';
import { addDays, localNow } from '../../src/common/utils/time';

/** Integration suites only run when a dedicated PostGIS test database is provided. */
export const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

export const API = '/api/v1';
export const ORIGIN = { lat: -6.2, lng: 106.816666 }; // Jakarta (Monas area)

export async function resetDb() {
  const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
  if (!rows[0].db.includes('test')) throw new Error(`Refusing to reset non-test database "${rows[0].db}"`);
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await runMigrations(() => undefined);
}

let seq = 0;
export async function createUser(role: UserRole, name = `User ${++seq}`) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, phone, role, email_verified_at) VALUES ($1, $2, '081234567890', $3::user_role, CASE WHEN $3::user_role <> 'GUEST' THEN NOW() END) RETURNING id`,
    [name, role === 'GUEST' ? null : `u${Date.now()}${++seq}@test.local`, role],
  );
  const id = rows[0].id;
  return { id, token: signAccessToken({ sub: id, role }), auth: { Authorization: `Bearer ${signAccessToken({ sub: id, role })}` } };
}

/** Point exactly `meters` away from origin (geodesic, via PostGIS). */
export async function pointAt(meters: number, azimuthDeg = 0) {
  const { rows } = await pool.query<{ lat: number; lng: number }>(
    `SELECT ST_Y(p::geometry) AS lat, ST_X(p::geometry) AS lng FROM
       (SELECT ST_Project(ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3::float8, radians($4::float8)) AS p) x`,
    [ORIGIN.lat, ORIGIN.lng, meters, azimuthDeg],
  );
  return rows[0];
}

export async function createWorkshop(opts: {
  lat: number;
  lng: number;
  status?: string;
  maxSlot?: number;
  mechanics?: { name: string; rating?: number; reviews?: number }[];
  price?: number;
  name?: string;
}) {
  const owner = await createUser('WORKSHOP_OWNER');
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO workshops (owner_id, name, address, phone, location, status, max_slot_per_hour, open_time, close_time)
     VALUES ($1, $2, 'Jl. Test No. 1', '081234567890', ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6, '07:00', '22:00')
     RETURNING id`,
    [owner.id, opts.name ?? `Bengkel ${seq}`, opts.lat, opts.lng, opts.status ?? 'APPROVED', opts.maxSlot ?? 3],
  );
  const workshopId = rows[0].id;
  const mechanicIds: string[] = [];
  for (const m of opts.mechanics ?? [{ name: 'Mekanik A' }]) {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO mechanics (workshop_id, name, avg_rating, total_reviews) VALUES ($1, $2, $3, $4) RETURNING id`,
      [workshopId, m.name, m.rating ?? 0, m.reviews ?? 0],
    );
    mechanicIds.push(r.rows[0].id);
  }
  const s = await pool.query<{ id: string }>(
    `INSERT INTO services (workshop_id, name, price, vehicle_type) VALUES ($1, 'Servis Rutin', $2, 'MOTOR') RETURNING id`,
    [workshopId, opts.price ?? 75000],
  );
  return { owner, workshopId, mechanicIds, serviceId: s.rows[0].id };
}

export const tomorrow = () => addDays(localNow().date, 1);

/** Smallest valid PNG header — passes magic-byte detection. */
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

export async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}
