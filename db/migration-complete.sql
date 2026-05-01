-- ============================================================
-- STUMP PROS WV — COMPLETE SAFE MIGRATION
-- Handles fresh DB or existing tables (all idempotent)
-- Run: psql $DATABASE_URL -f db/migration-complete.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PRICING CONFIG (key-value store for pricing settings)
-- Separate from the existing settings table (single-row model)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_config (
  id          SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id               SERIAL PRIMARY KEY,
  name             TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  source           TEXT DEFAULT 'website',
  contact_pref     TEXT DEFAULT 'text',
  status           TEXT DEFAULT 'new',
  stump_count      INTEGER,
  notes            TEXT,
  auto_contacted   BOOLEAN DEFAULT FALSE,
  auto_contacted_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESTIMATES
-- ============================================================
CREATE TABLE IF NOT EXISTS estimates (
  id              SERIAL PRIMARY KEY,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  address         TEXT,
  stump_count     INTEGER DEFAULT 1,
  total_amount    NUMERIC(10,2),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add approval columns (safe if already exist)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS approval_token   UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS approved_by      TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signature_data   TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ;

-- Backfill missing approval tokens on existing rows
UPDATE estimates SET approval_token = gen_random_uuid() WHERE approval_token IS NULL;

-- ============================================================
-- ESTIMATE STUMP LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS estimate_stump_items (
  id              SERIAL PRIMARY KEY,
  estimate_id     INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  stump_number    INTEGER NOT NULL DEFAULT 1,
  diameter_inches NUMERIC(5,1) NOT NULL,
  difficulty      TEXT NOT NULL DEFAULT 'normal',
  access          TEXT NOT NULL DEFAULT 'open',
  depth           TEXT NOT NULL DEFAULT 'standard',
  cleanup         TEXT NOT NULL DEFAULT 'none',
  notes           TEXT,
  base_price      NUMERIC(10,2) NOT NULL,
  subtotal        NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESTIMATE PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS estimate_photos (
  id                  SERIAL PRIMARY KEY,
  estimate_id         INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  cloudinary_url      TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  caption             TEXT,            -- e.g. "Before", "After", "Access issue"
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_photos_estimate_id ON estimate_photos(estimate_id);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER,
  estimate_id     INTEGER REFERENCES estimates(id) ON DELETE SET NULL,
  lead_id         INTEGER,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  address         TEXT,
  invoice_number  TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending',
  subtotal        NUMERIC(10,2) NOT NULL,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL,
  paid_at         TIMESTAMPTZ,
  payment_method  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stump_number    INTEGER,
  description     TEXT NOT NULL,
  diameter_inches NUMERIC(5,1),
  difficulty      TEXT,
  access          TEXT,
  depth           TEXT,
  cleanup         TEXT,
  unit_price      NUMERIC(10,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  total           NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id              SERIAL PRIMARY KEY,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  estimate_id     INTEGER REFERENCES estimates(id) ON DELETE SET NULL,
  invoice_id      INTEGER,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  address         TEXT,
  stump_count     INTEGER,
  total_amount    NUMERIC(10,2),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending_schedule',
  queue_position  INTEGER,
  scheduled_date  DATE,
  scheduled_time  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Safe column additions for jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimate_id    INTEGER REFERENCES estimates(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_id     INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

-- Update jobs status constraint to include pending_schedule
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending_schedule','scheduled','in_progress','completed','cancelled'));

-- ============================================================
-- FOLLOW-UP TABLES (drip sequences)
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id          SERIAL PRIMARY KEY,
  sequence    TEXT NOT NULL,
  step        INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL,
  message     TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_up_queue (
  id              SERIAL PRIMARY KEY,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  template_id     INTEGER REFERENCES follow_up_templates(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  job_id      INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body        TEXT NOT NULL,
  from_number TEXT,
  to_number   TEXT,
  quo_id      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEW REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  id           SERIAL PRIMARY KEY,
  job_id       INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  method       TEXT DEFAULT 'sms',
  scheduled_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRICING CONFIG SEED (upsert — safe to re-run)
-- ============================================================
INSERT INTO pricing_config (key, value, description) VALUES
  ('price_per_inch',         '5.00',                                          'Base price per inch of stump diameter ($)'),
  ('min_charge_per_stump',   '50.00',                                         'Minimum charge per individual stump ($)'),
  ('min_charge_per_job',     '225.00',                                        'Minimum total job charge ($)'),
  ('difficulty_multipliers', '{"normal":1.0,"hard":1.25,"very_dense":1.5}',  'Multipliers by wood hardness'),
  ('access_multipliers',     '{"open":1.0,"limited":1.25,"very_limited":1.5}','Multipliers by site access'),
  ('depth_multipliers',      '{"standard":1.0,"extra_deep":1.25}',           'Multipliers by grinding depth'),
  ('cleanup_multipliers',    '{"none":1.0,"chips_only":1.5,"full_cleanup":2.0}','Multipliers by cleanup level'),
  ('large_stump_price_per_inch', '7.00', 'Price per inch for stumps over 40" diameter ($)'),
  ('roots_multipliers',   '{"none":1.0,"surface":1.25,"full_yard":1.6}',   'Multipliers by root complexity'),
  ('height_multipliers',  '{"flush":1.0,"mid":1.25,"tall":1.5}',          'Multipliers by stump height')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE pricing_config.value = '';

ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS roots      TEXT    NOT NULL DEFAULT 'none';
ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS height     TEXT    NOT NULL DEFAULT 'flush';
ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS rocky      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS extra_deep BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE estimate_photos      ADD COLUMN IF NOT EXISTS stump_number INTEGER;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_estimates_approval_token ON estimates(approval_token);
CREATE INDEX IF NOT EXISTS idx_estimates_lead_id        ON estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id          ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status              ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_queue               ON jobs(queue_position) WHERE status = 'pending_schedule';
CREATE INDEX IF NOT EXISTS idx_leads_phone              ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id         ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_status   ON follow_up_queue(status, scheduled_at);
