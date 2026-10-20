// PBI-306: k6 stress test — fire N simultaneous POST /booking at one slot and prove zero overbooking.
//
// Usage:
//   k6 run -e BASE_URL=http://localhost:8080/api/v1 -e WORKSHOP_ID=<uuid> -e SERVICE_ID=<uuid> \
//          -e BOOKING_DATE=2026-10-20 -e TIME_SLOT=10:00 -e TOKENS_FILE=./tokens.json tests/load/booking-concurrency.k6.js
//
// tokens.json = ["<customer access token>", ...] — one distinct CUSTOMER per VU (duplicate bookings per
// customer are rejected by design). Afterwards check:
//   SELECT current_booked, max_slot_per_hour FROM workshop_quotas WHERE workshop_id = '<uuid>' AND slot_date = '<date>' AND slot_time = '<slot>';
//   -> current_booked must equal min(VUs, max_slot_per_hour); the rest are IN_QUEUE.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('tokens', () => JSON.parse(open(__ENV.TOKENS_FILE || './tokens.json')));
const confirmed = new Counter('bookings_confirmed');
const queued = new Counter('bookings_in_queue');

export const options = {
  // Spread connections over every API replica behind the same DNS name (Docker: `api`)
  dns: { ttl: '0', select: 'roundRobin', policy: 'any' },
  scenarios: {
    burst: {
      executor: 'per-vu-iterations',
      vus: Math.min(Number(__ENV.VUS || 100), tokens.length),
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    'http_req_duration{expected_response:true}': ['p(95)<2000'],
  },
};

export default function () {
  const token = tokens[__VU - 1];
  const res = http.post(
    `${__ENV.BASE_URL}/booking`,
    JSON.stringify({
      workshop_id: __ENV.WORKSHOP_ID,
      service_id: __ENV.SERVICE_ID,
      booking_date: __ENV.BOOKING_DATE,
      time_slot: __ENV.TIME_SLOT || '10:00',
    }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
  );
  check(res, { 'status is 201': (r) => r.status === 201 });
  const status = res.status === 201 ? res.json('data.status') : null;
  if (status === 'CONFIRMED') confirmed.add(1);
  if (status === 'IN_QUEUE') queued.add(1);
}
