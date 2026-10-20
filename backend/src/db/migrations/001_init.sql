-- =====================================================================
-- 001_init.sql : Core schema for Bengkel platform
-- Requires PostgreSQL 14+ with PostGIS (Supabase: enable the postgis extension)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Enums ----------
CREATE TYPE user_role       AS ENUM ('CUSTOMER', 'GUEST', 'WORKSHOP_OWNER', 'ADMIN');
CREATE TYPE workshop_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE vehicle_type    AS ENUM ('MOTOR', 'MOBIL');
CREATE TYPE order_type      AS ENUM ('EMERGENCY', 'BOOKING');
CREATE TYPE order_status    AS ENUM (
  'PENDING',        -- emergency: waiting for workshop response
  'CONFIRMED',      -- booking: slot secured
  'IN_QUEUE',       -- booking: slot saturated, waiting list
  'ACCEPTED',       -- emergency: workshop accepted, mechanic dispatched
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'UNASSIGNED'      -- emergency: no workshop accepted after all routing attempts
);
CREATE TYPE payment_status  AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- ---------- Users & Auth ----------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) UNIQUE,
  phone          VARCHAR(20),
  password_hash  TEXT,
  role           user_role NOT NULL DEFAULT 'CUSTOMER',
  google_sub     VARCHAR(255) UNIQUE,
  last_location  GEOGRAPHY(POINT, 4326),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_lower CHECK (email IS NULL OR email = LOWER(email))
);

CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   CHAR(64) NOT NULL UNIQUE,      -- SHA-256 hex of the opaque token (raw token never stored)
  family_id    UUID NOT NULL,                 -- rotation chain; whole family revoked on reuse
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent   VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Workshops ----------
CREATE TABLE workshops (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  name               VARCHAR(150) NOT NULL,
  description        TEXT,
  address            TEXT NOT NULL,
  phone              VARCHAR(20) NOT NULL,
  location           GEOGRAPHY(POINT, 4326) NOT NULL,
  vehicle_types      vehicle_type[] NOT NULL DEFAULT ARRAY['MOTOR','MOBIL']::vehicle_type[],
  status             workshop_status NOT NULL DEFAULT 'PENDING',
  status_reason      TEXT,
  is_open            BOOLEAN NOT NULL DEFAULT TRUE,
  accepts_emergency  BOOLEAN NOT NULL DEFAULT TRUE,
  open_time          TIME NOT NULL DEFAULT '08:00',
  close_time         TIME NOT NULL DEFAULT '17:00',
  max_slot_per_hour  SMALLINT NOT NULL DEFAULT 3 CHECK (max_slot_per_hour BETWEEN 1 AND 100),
  qris_image_path    TEXT,
  avg_rating         NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews      INTEGER NOT NULL DEFAULT 0,
  approved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workshop_hours CHECK (open_time < close_time)
);

CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id       UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name              VARCHAR(120) NOT NULL,
  description       TEXT,
  price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  duration_minutes  SMALLINT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  vehicle_type      vehicle_type NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mechanics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id      UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  phone            VARCHAR(20),
  specializations  TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hourly quota rows (lazily materialised from workshops.max_slot_per_hour, locked with FOR UPDATE)
CREATE TABLE workshop_quotas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id        UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  slot_date          DATE NOT NULL,
  slot_time          TIME NOT NULL,
  max_slot_per_hour  SMALLINT NOT NULL CHECK (max_slot_per_hour >= 0),
  current_booked     SMALLINT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_quota_slot UNIQUE (workshop_id, slot_date, slot_time),
  -- Last line of defence: the database itself refuses overbooking
  CONSTRAINT quota_not_overbooked CHECK (current_booked >= 0 AND current_booked <= max_slot_per_hour)
);

-- ---------- Orders ----------
CREATE SEQUENCE order_number_seq;

CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  VARCHAR(30) NOT NULL UNIQUE,
  type          order_type NOT NULL,
  status        order_status NOT NULL,
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  workshop_id   UUID REFERENCES workshops(id) ON DELETE RESTRICT,
  mechanic_id   UUID REFERENCES mechanics(id) ON DELETE SET NULL,
  vehicle_type  vehicle_type NOT NULL,
  vehicle_plate VARCHAR(15),
  notes         TEXT,
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE emergency_details (
  order_id               UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  location               GEOGRAPHY(POINT, 4326) NOT NULL,
  address_note           TEXT,
  problem_description    TEXT NOT NULL,
  distance_meters        NUMERIC(10,2),
  response_deadline      TIMESTAMPTZ,
  routing_attempts       SMALLINT NOT NULL DEFAULT 1,
  attempted_workshop_ids UUID[] NOT NULL DEFAULT '{}',
  responded_at           TIMESTAMPTZ
);

CREATE TABLE booking_details (
  order_id        UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  booking_date    DATE NOT NULL,
  time_slot       TIME NOT NULL,
  queue_number    INTEGER NOT NULL,
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status            payment_status NOT NULL DEFAULT 'UNPAID',
  proof_path        TEXT,
  proof_mime        VARCHAR(50),
  uploaded_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  mechanic_id  UUID REFERENCES mechanics(id) ON DELETE SET NULL,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Indexes (PRD 6.3) ----------
CREATE INDEX idx_workshops_location_gist        ON workshops USING GIST (location);
CREATE INDEX idx_workshops_status               ON workshops(status);
CREATE INDEX idx_orders_customer_id             ON orders(customer_id);
CREATE INDEX idx_orders_workshop_id             ON orders(workshop_id);
CREATE INDEX idx_orders_status                  ON orders(status);
CREATE INDEX idx_booking_details_date_slot      ON booking_details(booking_date, time_slot);
CREATE INDEX idx_refresh_tokens_hash            ON refresh_tokens(token_hash);
CREATE INDEX idx_mechanics_workshop_id_rating   ON mechanics(workshop_id, avg_rating DESC);
-- Supporting indexes
CREATE INDEX idx_refresh_tokens_family          ON refresh_tokens(family_id);
CREATE INDEX idx_services_workshop_id           ON services(workshop_id);
CREATE INDEX idx_reviews_workshop_id            ON reviews(workshop_id);
CREATE INDEX idx_transactions_status            ON transactions(status);
CREATE INDEX idx_emergency_pending_deadline     ON emergency_details(response_deadline) WHERE responded_at IS NULL;
CREATE INDEX idx_booking_reminder               ON booking_details(booking_date) WHERE reminder_sent = FALSE;
