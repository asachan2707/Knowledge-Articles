-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NOT NULL UNIQUE,
  role       VARCHAR(10)  NOT NULL CHECK (role IN ('rider', 'driver')),
  rating     NUMERIC(3,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ  DEFAULT now()
);

-- ─── Driver profiles ──────────────────────────────────────────────────────────
CREATE TABLE driver_profiles (
  driver_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_make   VARCHAR(50),
  vehicle_model  VARCHAR(50),
  vehicle_year   SMALLINT,
  license_plate  VARCHAR(20) NOT NULL,
  is_online      BOOLEAN     DEFAULT false,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── Trips ────────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id      UUID        NOT NULL REFERENCES users(id),
  driver_id     UUID        REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'requesting'
                  CHECK (status IN (
                    'requesting','accepted','driver_arrived',
                    'in_progress','completed','cancelled'
                  )),
  origin_lat    NUMERIC(9,6) NOT NULL,
  origin_lng    NUMERIC(9,6) NOT NULL,
  dest_lat      NUMERIC(9,6) NOT NULL,
  dest_lng      NUMERIC(9,6) NOT NULL,
  origin_address  TEXT,
  dest_address    TEXT,
  base_fare     NUMERIC(8,2),
  surge_mult    NUMERIC(4,2) DEFAULT 1.00,
  final_fare    NUMERIC(8,2),
  distance_km   NUMERIC(7,2),
  duration_sec  INT,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  arrived_at    TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,

  -- Prevents a rider from having two simultaneous active requests
  CONSTRAINT uq_rider_active UNIQUE (rider_id, created_at)
);

CREATE INDEX idx_trips_driver_status ON trips (driver_id, status);
CREATE INDEX idx_trips_rider_id      ON trips (rider_id, created_at DESC);
CREATE INDEX idx_trips_status        ON trips (status);

-- ─── Trip ratings ─────────────────────────────────────────────────────────────
CREATE TABLE trip_ratings (
  trip_id    UUID        PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  from_id    UUID        NOT NULL REFERENCES users(id),
  to_id      UUID        NOT NULL REFERENCES users(id),
  score      SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    TEXT,
  rated_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── Seed demo users ──────────────────────────────────────────────────────────
INSERT INTO users (id, name, phone, role, rating) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Alice Rider',  '+10000000001', 'rider',  4.90),
  ('a0000000-0000-0000-0000-000000000002', 'Bob Rider',    '+10000000002', 'rider',  4.70),
  ('d0000000-0000-0000-0000-000000000001', 'Dave Driver',  '+10000000003', 'driver', 4.85),
  ('d0000000-0000-0000-0000-000000000002', 'Eve Driver',   '+10000000004', 'driver', 4.92),
  ('d0000000-0000-0000-0000-000000000003', 'Frank Driver', '+10000000005', 'driver', 4.75);

INSERT INTO driver_profiles (driver_id, vehicle_make, vehicle_model, vehicle_year, license_plate) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Toyota',  'Prius',    2022, 'DAVE001'),
  ('d0000000-0000-0000-0000-000000000002', 'Honda',   'Accord',   2021, 'EVE0002'),
  ('d0000000-0000-0000-0000-000000000003', 'Ford',    'Explorer', 2023, 'FRANK03');
