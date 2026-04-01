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
  auto_text TEXT DEFAULT 'Hey {{name}}, thanks for reaching out to Stump Pros WV! How many stumps do you need removed?',
  review_delay INTEGER DEFAULT 24,
  google_review_url TEXT,
  facebook_review_url TEXT
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
