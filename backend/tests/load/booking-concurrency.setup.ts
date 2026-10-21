/**
 * PBI-306 helper for the k6 booking stress test.
 *
 *   npx ts-node tests/load/booking-concurrency.setup.ts prepare [customers=100]
 *     -> creates an isolated APPROVED workshop (max 3 bookings/hour, 3 mechanics, 1 service) and N
 *        CUSTOMER accounts directly in the DB (the API's auth rate limit would block mass sign-ups),
 *        signs one access token per customer, writes tests/load/.generated/{tokens.json,run.json}.
 *
 *   npx ts-node tests/load/booking-concurrency.setup.ts verify <HH:00> [<HH:00> ...]
 *     -> checks each slot in the DB: no overbooking, exactly min(N, max) CONFIRMED, the rest IN_QUEUE,
 *        unique gap-free queue numbers, distinct mechanics. Exits 1 on any violation.
 *
 * Uses DATABASE_URL / JWT_ACCESS_SECRET from backend/.env (the same values the Docker API uses).
 */
import fs from 'fs';
import path from 'path';
import { pool } from '../../src/config/database';
import { signAccessToken } from '../../src/common/utils/jwt';
import { addDays, localNow } from '../../src/common/utils/time';

const OUT = path.join(__dirname, '.generated');
const MAX_SLOT = 3;

async function prepare(customers: number) {
  const tag = `k6-${Date.now().toString(36)}`;
  const owner = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, phone, role) VALUES ($1, $2, '081200000000', 'WORKSHOP_OWNER') RETURNING id`,
    [`Owner ${tag}`, `${tag}-owner@loadtest.local`],
  );
  // Far from Jakarta test data so it never interferes with emergency routing of other tests.
  const ws = await pool.query<{ id: string }>(
    `INSERT INTO workshops (owner_id, name, address, phone, location, status, max_slot_per_hour, open_time, close_time, approved_at)
     VALUES ($1, $2, 'Load test', '081200000000', ST_SetSRID(ST_MakePoint(110.0, -7.0), 4326)::geography, 'APPROVED', $3, '07:00', '22:00', NOW())
     RETURNING id`,
    [owner.rows[0].id, `Bengkel ${tag}`, MAX_SLOT],
  );
  const workshopId = ws.rows[0].id;
  for (const m of ['Mekanik 1', 'Mekanik 2', 'Mekanik 3']) {
    await pool.query(`INSERT INTO mechanics (workshop_id, name) VALUES ($1, $2)`, [workshopId, m]);
  }
  const svc = await pool.query<{ id: string }>(
    `INSERT INTO services (workshop_id, name, price, vehicle_type) VALUES ($1, 'Servis k6', 50000, 'MOTOR') RETURNING id`,
    [workshopId],
  );
  const users = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, phone, role, email_verified_at)
     SELECT 'Customer ' || g, $1 || '-c' || g || '@loadtest.local', '081200000000', 'CUSTOMER', NOW()
     FROM generate_series(1, $2::int) g RETURNING id`,
    [tag, customers],
  );
  const tokens = users.rows.map((u) => signAccessToken({ sub: u.id, role: 'CUSTOMER' }, undefined, '1h'));

  const run = { tag, workshopId, serviceId: svc.rows[0].id, bookingDate: addDays(localNow().date, 1), maxSlot: MAX_SLOT, customers };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify(tokens));
  fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify(run, null, 2));
  console.log(JSON.stringify(run));
}

async function verify(slots: string[]) {
  const run = JSON.parse(fs.readFileSync(path.join(OUT, 'run.json'), 'utf8'));
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    console.log(`  FAIL: ${msg}`);
  };

  for (const slot of slots) {
    const quota = await pool.query<{ current_booked: number; max_slot_per_hour: number }>(
      `SELECT current_booked, max_slot_per_hour FROM workshop_quotas WHERE workshop_id = $1 AND slot_date = $2 AND slot_time = $3`,
      [run.workshopId, run.bookingDate, slot],
    );
    const orders = await pool.query<{ status: string; queue_number: number; mechanic_id: string | null }>(
      `SELECT o.status, bd.queue_number, o.mechanic_id FROM orders o JOIN booking_details bd ON bd.order_id = o.id
       WHERE o.workshop_id = $1 AND bd.booking_date = $2 AND bd.time_slot = $3`,
      [run.workshopId, run.bookingDate, slot],
    );
    const q = quota.rows[0];
    const confirmed = orders.rows.filter((o) => o.status === 'CONFIRMED');
    const queued = orders.rows.filter((o) => o.status === 'IN_QUEUE');
    const mechanics = new Set(confirmed.map((o) => o.mechanic_id).filter(Boolean));
    console.log(
      `slot ${slot}: bookings=${orders.rowCount} CONFIRMED=${confirmed.length} IN_QUEUE=${queued.length} ` +
        `quota=${q?.current_booked}/${q?.max_slot_per_hour} distinct_mechanics=${mechanics.size}`,
    );
    if (!q) {
      fail('no quota row');
      continue;
    }
    if (q.current_booked > q.max_slot_per_hour) fail('OVERBOOKED');
    if (confirmed.length !== q.current_booked) fail('CONFIRMED count does not match quota counter');
    if (confirmed.length !== Math.min(orders.rowCount ?? 0, q.max_slot_per_hour)) fail('wrong number of CONFIRMED bookings');
    if (confirmed.length + queued.length !== orders.rowCount) fail('unexpected statuses present');
    if (mechanics.size !== confirmed.length) fail('a mechanic was double-booked in this slot');
  }

  // Queue numbers are per workshop per day across all slots: must be unique and gap-free.
  const qn = await pool.query<{ queue_number: number }>(
    `SELECT bd.queue_number FROM orders o JOIN booking_details bd ON bd.order_id = o.id
     WHERE o.workshop_id = $1 AND bd.booking_date = $2 ORDER BY bd.queue_number`,
    [run.workshopId, run.bookingDate],
  );
  const nums = qn.rows.map((r) => r.queue_number);
  const gapFree = nums.every((n, i) => n === i + 1);
  console.log(`queue numbers for the day: ${nums.length} issued, unique & gap-free=${gapFree}`);
  if (!gapFree) fail('duplicate or missing queue numbers');

  console.log(ok ? 'RESULT: PASS (zero overbooking)' : 'RESULT: FAIL');
  process.exitCode = ok ? 0 : 1;
}

const [cmd, ...args] = process.argv.slice(2);
(cmd === 'prepare' ? prepare(Number(args[0] ?? 100)) : cmd === 'verify' ? verify(args.length ? args : ['10:00']) : Promise.reject(new Error('usage: prepare | verify <slots>')))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
