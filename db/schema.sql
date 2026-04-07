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
  auto_text TEXT DEFAULT 'Hi {{name}}, thanks for reaching out to Stump Pros WV! We''ll get back to you shortly. In the meantime, feel free to text us photos of your stumps for a quick quote!',
  review_delay INTEGER DEFAULT 24,
  google_review_url TEXT,
  facebook_review_url TEXT,
  qb_access_token TEXT,
  qb_refresh_token TEXT,
  qb_realm_id TEXT,
  qb_token_expires_at TIMESTAMPTZ
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
UPDATE settings SET auto_text = 'Hi {{name}}, thanks for reaching out to Stump Pros WV! We''ll get back to you shortly. In the meantime, feel free to text us photos of your stumps for a quick quote!' WHERE id = 1 AND auto_text = 'Hi {{name}}, thank you for reaching out to Stump Pros WV! We''ve received your message and will be in touch with you shortly.';

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

-- Customer database
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (lower(name));
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);

-- Photos on estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
-- Customer link on estimates/jobs/leads
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Follow-up drip system
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id SERIAL PRIMARY KEY,
  sequence_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_name, step_number)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES follow_up_templates(id),
  sequence_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS follow_ups_status_scheduled_idx ON follow_ups (status, scheduled_at);
CREATE INDEX IF NOT EXISTS follow_ups_lead_id_idx ON follow_ups (lead_id);

-- Seed drip templates
INSERT INTO follow_up_templates (sequence_name, step_number, delay_hours, message) VALUES
  ('no_response', 1, 2, 'Hi {{name}}, just following up! We''d love to help with your stump grinding. Feel free to text us photos of the stumps for a quick free quote!'),
  ('no_response', 2, 48, 'Hey {{name}}, still interested in getting those stumps taken care of? We offer free on-site estimates and competitive pricing. Just reply to this text!'),
  ('no_response', 3, 120, 'Hi {{name}}, this is our last follow-up. If you ever need stump grinding, don''t hesitate to reach out. We''re here to help! - Stump Pros WV'),
  ('quoted_not_booked', 1, 48, 'Hi {{name}}, just checking in on the estimate we sent over. Any questions? We''re happy to help!'),
  ('quoted_not_booked', 2, 120, 'Hey {{name}}, wanted to make sure you got our estimate. We can usually get you on the schedule within a few days. Let us know!'),
  ('quoted_not_booked', 3, 192, 'Hi {{name}}, just a friendly reminder about your stump grinding estimate. We''d love to get this knocked out for you. Reply anytime!'),
  ('quoted_not_booked', 4, 336, 'Hi {{name}}, this is our last follow-up on the estimate. If you''d like to move forward or have questions, just text us back. Thanks! - Stump Pros WV')
ON CONFLICT (sequence_name, step_number) DO NOTHING;

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
