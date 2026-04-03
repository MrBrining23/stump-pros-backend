CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  source TEXT DEFAULT 'website',
  contact_pref TEXT DEFAULT 'call',
  stump_count INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'new',
  auto_contacted BOOLEAN DEFAULT FALSE,
  auto_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id),
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  package TEXT,
  stump_count INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'estimate',
  scheduled_date DATE,
  scheduled_time TIME,
  amount NUMERIC(10,2),
  completed_at TIMESTAMPTZ,
  review_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  auto_text TEXT DEFAULT 'Hi {{name}}, thank you for reaching out to Stump Pros WV! We''ve received your message and will be in touch with you shortly.',
  review_delay INTEGER DEFAULT 24,
  google_review_url TEXT,
  facebook_review_url TEXT,
  qb_access_token TEXT,
  qb_refresh_token TEXT,
  qb_realm_id TEXT,
  qb_token_expires_at TIMESTAMPTZ
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE settings ADD COLUMN IF NOT EXISTS estimate_discount_pct INTEGER DEFAULT 10;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS estimate_intro_msg TEXT DEFAULT 'Hi {name}, here is your estimate from Stump Pros WV:';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS estimate_discount_msg TEXT DEFAULT 'We''d still love to earn your business! Here''s a special discounted offer just for you:';

CREATE TABLE IF NOT EXISTS estimates (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  description TEXT,
  amount NUMERIC(10,2),
  discount_pct INTEGER DEFAULT 0,
  discounted_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending',
  approval_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  discount_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  estimate_id INTEGER REFERENCES estimates(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  line_items JSONB DEFAULT '[]',
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_pct NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  qb_invoice_id TEXT,
  qb_invoice_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
