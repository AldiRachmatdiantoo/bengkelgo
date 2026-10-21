# Bengkel API (Backend)

Express + TypeScript backend for the Bengkel workshop booking and emergency roadside assistance platform (see `../prd.md`).
It uses PostgreSQL + PostGIS (Supabase or Docker), Redis for rate limiting, JWT with refresh-token rotation, Google OAuth (PKCE), guest sessions and node-cron.

## Quick start

```bash
cp .env.example .env            # then edit secrets
npm install
docker compose up -d db redis   # PostGIS on :5433, Redis on :6380
# set DATABASE_URL=postgres://bengkel:bengkel@localhost:5433/bengkel and REDIS_URL=redis://localhost:6380 in .env
npm run migrate
npm run seed                    # creates the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run dev                     # http://localhost:4000/api/v1
```

Full stack (2 API replicas behind NGINX `least_conn` on :8080): `docker compose up -d --build`.

**Supabase:** enable the `postgis` extension, set `DATABASE_URL` to the project connection string and `DATABASE_SSL=true`, then run `npm run migrate`.

## Structure

```
src/
  config/        env (Zod-validated), database pool, redis, logger, mailer
  common/        db transaction manager, middlewares (auth/RBAC, validate, rate limiter, upload, errors), utils
  db/            SQL migrations + runner, admin seed
  features/      auth · emergency · booking · workshop · order · payment · review · admin
                 · notification · vehicle · stats
                 (each: *.schema.ts → *.routes.ts → *.controller.ts → *.service.ts → *.repository.ts)
                 routes: URL + middleware (auth, validation, upload) only; controller: reads the
                 validated input and shapes the HTTP response; service: business rules; repository: SQL.
  jobs/          node-cron scheduler: booking reminders, emergency re-routing
  routes/        central router
```

## How the PRD rules are implemented

| PRD requirement | Where |
| --- | --- |
| Multi-table writes in `BEGIN…COMMIT/ROLLBACK` | `common/db/transaction.ts` → `withTransaction()`. Used by every multi-table mutation. |
| `SELECT … FOR UPDATE` on booking quota | `booking.repository.lockQuota()`; the DB `CHECK (current_booked <= max_slot_per_hour)` is a second guard. |
| Queue numbers / `IN_QUEUE` | `booking.logic.decideSlot()`. A full slot puts the booking on the waiting list, and cancelling or raising capacity promotes the next booking in FIFO order. |
| Mechanic auto-assignment | `booking.repository.pickMechanicForSlot()` and `emergency.repository.pickFreeMechanic()` |
| 5 km `ST_DWithin` scan + GIST index | `emergency.repository.scan()` and the indexes in `001_init.sql` |
| Smart routing (distance + mechanic rating) | `emergency.logic.ts`: score = 0.6·proximity + 0.4·rating |
| 2-minute fallback re-routing | `emergencyService.rerouteExpired()`, run every 15 s with `FOR UPDATE SKIP LOCKED` (safe with several replicas) |
| Rate limits 10/min emergency, 15/15 min auth | `rateLimiter.ts`: Redis sliding window in an atomic Lua script, with a memory fallback |
| Helmet, CORS allow-list, Zod validation, parameterised SQL | `app.ts`, `validate.ts`, all repositories |
| Refresh rotation + reuse detection | `auth.service.refresh()`: only token hashes are stored, and reusing a token revokes the whole family |
| QRIS upload < 2 MB, real image type | `upload.ts` checks multer limits and magic bytes, and files get random names |
| Reminder ~2 hours before the slot (in-app + email) | `jobs/bookingReminder.job.ts` → `sendSoonReminders()`, every 5 minutes, `reminder_2h_sent` |
| Daily reminder for `CURRENT_DATE + 1` | `jobs/bookingReminder.job.ts`, which claims rows atomically and sets `reminder_sent = true` |
| BOLA protection | Every order, payment or workshop lookup is scoped to the caller. When you don't own a resource the API returns 404 instead of 403, so it doesn't reveal that the resource exists. |

## API (base `/api/v1`)

Database diagram: [../docs/erd.md](../docs/erd.md) (regenerate with `scripts/erd/build-erd.py`).

Full Postman documentation (88 requests, runnable end-to-end, with real response examples) is in [docs/postman](docs/postman/README.md).

| Endpoint | Method | Access |
| --- | --- | --- |
| `/auth/register/customer` · `/auth/register/workshop` | POST | Public |
| `/auth/login` · `/auth/google` · `/auth/guest` | POST | Public |
| `/auth/refresh` · `/auth/logout` | POST | Refresh cookie/body |
| `/auth/me` | GET | Any authenticated user |
| `/auth/email/verify` · `/auth/email/resend` (6-digit code mailed at sign-up; booking needs a verified email) | POST | Signed-in user |
| `/emergency/scan` | POST | Public (rate limited) |
| `/emergency/request` | POST | Customer / Guest |
| `/emergency/:order_id/respond` | PATCH | Workshop owner (`ACCEPT` / `DECLINE`, optional `mechanic_id`) |
| `/emergency/:order_id/price` | PATCH | Workshop owner (revise the SOS price until the customer pays) |
| `/booking` | POST | Customer |
| `/workshops` (`?sort=distance\|rating\|recommended`) · `/workshops/:id` · `/workshops/:id/availability?date=` · `/workshops/:id/reviews` | GET | Public |
| `/workshops/me` · `/workshops/profile` (PUT) · `/workshops/qris` (PUT, multipart `qris`) | | Workshop owner |
| `/workshops/services` · `/workshops/mechanics` (GET/POST, PATCH/DELETE `/:id`; deleting a service is a soft delete) | | Workshop owner |
| `/workshops/me/reviews` (GET) · `/workshops/reviews/:id/reply` (PUT/DELETE) | | Workshop owner |
| `/workshops/quotas` (GET `?date=`, PUT override) | | Workshop owner |
| `/orders/me` · `/orders/workshop` · `/orders/:id` | GET | Owner of the order / workshop / admin |
| `/orders/:id/status` (PATCH) · `/orders/:id/cancel` (PATCH) | | Workshop owner · Customer |
| `/payments/upload` (multipart `order_id` + `proof`, optional `payer_reference`, `payer_name`) | POST | Customer / Guest |
| `/payments/:order_id` · `/qris` · `/proof` | GET | Parties of the order |
| `/payments/:order_id/verify` | PATCH | Workshop owner |
| `/reviews` | POST | Customer / Guest (completed orders) |
| `/admin/workshops` · `/admin/workshops/:id/approval` · `/admin/reports/transactions` | GET/PATCH/GET | Admin |
| `/admin/stats` · `/admin/search?q=` · `/admin/audit-logs` · `/admin/health` | GET | Admin |
| `/admin/users` (GET) · `/admin/users/:id/active` · `/admin/users/:id/verify-email` (PATCH) · `/admin/users/admins` (POST) | | Admin (access management) |
| `/notifications` (GET) · `/notifications/read` (PATCH) | | Any authenticated user |
| `/orders/:id/history` (GET) · `/orders/:id/reschedule` (PATCH) | | Parties of the order · Customer |
| `/vehicles` (GET/POST, PATCH/DELETE `/:id`) | | Customer / Guest |
| `/workshops/holidays` · `/workshops/photos` · `/workshops/mechanics/:id/photo` · `/workshops/me/stats` | | Workshop owner |
| `/workshops/:id/next-slot` · `/workshops/:id/photos/:photoId` · `/stats/public` | GET | Public |
| `/geocode/search?q=` · `/geocode/reverse?lat=&lng=` (OpenStreetMap place search / address of a point, rate limited) | GET | Public |

Responses follow `{ success, data }` or `{ success: false, error: { code, message, details? } }`.

## Order lifecycle

- **Emergency:** `PENDING` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED`. A decline or timeout re-routes the order. Once no workshop is left, it becomes `UNASSIGNED`.
- **Booking:** `CONFIRMED` (or `IN_QUEUE`) → `IN_PROGRESS` → `COMPLETED`. Either party can move it to `CANCELLED`.
- **Payment:** `UNPAID` → `PENDING_VERIFICATION` → `VERIFIED` (or `REJECTED`, after which the customer can upload again). A paid order cancelled by the workshop becomes `REFUNDED`: the owner must send `refund_confirmed: true` (money goes to the workshop's own QRIS, so the workshop returns it). Nobody can cancel while a proof is `PENDING_VERIFICATION`.

## Testing

```bash
npm run test:unit                       # no DB needed: JWT, hashing, queue logic, routing, rate limiter, HTTP security
TEST_DATABASE_URL=postgres://bengkel:bengkel@localhost:5433/bengkel_test npm run test:integration
```

The integration suites need a PostGIS database whose name contains `test`, because the suite drops and recreates its schema. They cover:
- spatial boundaries (4.9 km vs 5.1 km) and use of the GIST index
- deliberate mid-transaction failures, to check the rollback
- 50 concurrent bookings against a 3-unit slot
- refresh-token reuse, BOLA, uploads, reviews and cron reminders

For HTTP load tests, use `tests/load/booking-concurrency.k6.js`.
