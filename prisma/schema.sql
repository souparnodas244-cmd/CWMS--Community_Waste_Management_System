-- Community Waste Management & Circular Economy Enabler Platform
-- Core relational schema (SQLite for local/dev prototype; column types map 1:1 to PostgreSQL
-- for production — see README "Moving to PostgreSQL").

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'CITIZEN'
                    CHECK (role IN ('CITIZEN', 'MUNICIPAL_ADMIN', 'RECYCLER', 'WASTE_PICKER')),
  points_balance  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bins (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  latitude          REAL NOT NULL,
  longitude         REAL NOT NULL,
  waste_type        TEXT NOT NULL DEFAULT 'MIXED'
                      CHECK (waste_type IN ('ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED')),
  fill_level        INTEGER NOT NULL DEFAULT 0,      -- 0-100 %, updated by sensors or manual reports
  capacity_liters   INTEGER NOT NULL DEFAULT 240,
  last_emptied_at   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id           TEXT PRIMARY KEY,
  bin_id       TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  fill_level   INTEGER NOT NULL,
  battery_pct  INTEGER,
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waste_logs (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path                TEXT,
  claimed_waste_type        TEXT NOT NULL
                               CHECK (claimed_waste_type IN ('ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED')),
  is_segregated_correctly   INTEGER,                 -- 0/1, NULL until verified
  confidence_score          REAL,                    -- 0..1 from the vision classifier
  points_awarded            INTEGER NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reward_partners (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  points_cost   INTEGER NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id    TEXT NOT NULL REFERENCES reward_partners(id),
  points_spent  INTEGER NOT NULL,
  redeemed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id             TEXT PRIMARY KEY,
  seller_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  waste_type     TEXT NOT NULL
                    CHECK (waste_type IN ('ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED')),
  quantity_kg    REAL NOT NULL,
  price_per_kg   REAL NOT NULL,
  status         TEXT NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id            TEXT PRIMARY KEY,
  listing_id    TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity_kg   REAL NOT NULL,
  total_price   REAL NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_routes (
  id                       TEXT PRIMARY KEY,
  vehicle_id               TEXT NOT NULL,
  bin_ids_json             TEXT NOT NULL,   -- JSON array, ordered stop sequence
  total_distance_km        REAL NOT NULL,
  estimated_fuel_saved_l   REAL,
  estimated_co2_saved_kg   REAL,
  status                   TEXT NOT NULL DEFAULT 'PLANNED'
                              CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bins_fill_level ON bins(fill_level);
CREATE INDEX IF NOT EXISTS idx_waste_logs_user ON waste_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_bin ON sensor_readings(bin_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);
