-- =====================================================================
-- 004_backlog_paket_b.sql : notifications, status history, audit log, workshop schedule,
-- saved vehicles, photos. Additive only: existing rows keep their values.
-- =====================================================================

-- ---------- In-app notifications (server side, per user) ----------
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL,
  title       VARCHAR(150) NOT NULL,
  body        TEXT,
  link        VARCHAR(200),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread  ON notifications(user_id) WHERE read_at IS NULL;

-- ---------- Order & payment status history (timeline), filled by triggers ----------
-- The acting user comes from transaction-local settings (app.actor_id / app.actor_role) set by the API;
-- changes made without them (e.g. scripts) are recorded with a NULL actor.
CREATE TABLE order_status_history (
  id           BIGSERIAL PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind         VARCHAR(10) NOT NULL CHECK (kind IN ('ORDER', 'PAYMENT')),
  from_status  VARCHAR(30),
  to_status    VARCHAR(30) NOT NULL,
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role   VARCHAR(20),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, id);

CREATE FUNCTION app_actor_id() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid
$$;
CREATE FUNCTION app_actor_role() RETURNS VARCHAR LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_role', true), '')
$$;

CREATE FUNCTION trg_order_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, kind, from_status, to_status, actor_id, actor_role)
    VALUES (NEW.id, 'ORDER', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END, NEW.status::text, app_actor_id(), app_actor_role());
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER orders_status_history AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_order_status_history();

CREATE FUNCTION trg_payment_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, kind, from_status, to_status, actor_id, actor_role)
    VALUES (NEW.order_id, 'PAYMENT', OLD.status::text, NEW.status::text, app_actor_id(), app_actor_role());
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER transactions_status_history AFTER UPDATE OF status ON transactions
  FOR EACH ROW EXECUTE FUNCTION trg_payment_status_history();

-- Existing orders get one starting entry with their current status.
INSERT INTO order_status_history (order_id, kind, from_status, to_status, created_at)
SELECT id, 'ORDER', NULL, status::text, created_at FROM orders;

-- ---------- Audit log (append-only) ----------
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(30) NOT NULL,
  entity_id   UUID,
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity  ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_actor   ON audit_logs(actor_id);

CREATE FUNCTION trg_audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END $$;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION trg_audit_logs_append_only();

-- ---------- Workshop schedule: weekly closed days, break, holidays ----------
-- closed_weekdays uses 0 = Sunday ... 6 = Saturday (business timezone).
ALTER TABLE workshops
  ADD COLUMN closed_weekdays SMALLINT[] NOT NULL DEFAULT '{}'
    CHECK (closed_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  ADD COLUMN break_start TIME,
  ADD COLUMN break_end   TIME,
  ADD CONSTRAINT workshop_break CHECK ((break_start IS NULL) = (break_end IS NULL) AND (break_start IS NULL OR break_start < break_end));

CREATE TABLE workshop_holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  holiday_date  DATE NOT NULL,
  note          VARCHAR(150),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workshop_holiday UNIQUE (workshop_id, holiday_date)
);

-- ---------- Saved vehicles ----------
CREATE TABLE vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type  vehicle_type NOT NULL,
  brand         VARCHAR(50) NOT NULL,
  model         VARCHAR(50),
  year          SMALLINT CHECK (year BETWEEN 1950 AND 2100),
  color         VARCHAR(30),
  plate         VARCHAR(15),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehicles_user ON vehicles(user_id) WHERE deleted_at IS NULL;

ALTER TABLE orders ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

ALTER TABLE emergency_details ADD COLUMN problem_category VARCHAR(20)
  CHECK (problem_category IN ('BATTERY', 'TIRE', 'ENGINE', 'FUEL', 'TOWING', 'LOCKOUT', 'OTHER'));

-- ---------- Photos ----------
CREATE TABLE workshop_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  is_cover     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workshop_photos_workshop ON workshop_photos(workshop_id, sort_order);
CREATE UNIQUE INDEX uq_workshop_cover ON workshop_photos(workshop_id) WHERE is_cover;

ALTER TABLE mechanics ADD COLUMN photo_path TEXT;
