require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pool = require('./db/pool');

const leadsRouter = require('./routes/leads');
const jobsRouter = require('./routes/jobs');
const settingsRouter = require('./routes/settings');
const smsRouter = require('./routes/sms');
const quickbooksRouter = require('./routes/quickbooks');
const webhooksRouter = require('./routes/webhooks');
const estimatesRouter = require('./routes/estimates');
const invoicesRouter = require('./routes/invoices');
const customersRouter = require('./routes/customers');
const { startCronJobs } = require('./services/cron');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/leads', leadsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/sms', smsRouter);
app.use('/api/quickbooks', quickbooksRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/approve', estimatesRouter);  // customer-facing approval links
app.use('/api/invoices', invoicesRouter);
app.use('/api/customers', customersRouter);

// Customer-facing estimate approval page
app.get('/estimate/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'estimate.html')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

async function runMigration() {
  // Run the full migration file first (idempotent)
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'migration-complete.sql'), 'utf8');
    await pool.query(schema);
    console.log('Migration file applied.');
  } catch (err) {
    console.error('Migration file error (will apply safety patches):', err.message);
  }

  // Safety patches — run individually so one failure doesn't block the others
  const patches = [
    `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
    `CREATE TABLE IF NOT EXISTS oauth_tokens (
       id SERIAL PRIMARY KEY, provider TEXT UNIQUE NOT NULL,
       access_token TEXT, refresh_token TEXT, realm_id TEXT,
       expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW())`,
    `ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS roots      TEXT    NOT NULL DEFAULT 'none'`,
    `ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS height     TEXT    NOT NULL DEFAULT 'flush'`,
    `ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS rocky      BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE estimate_stump_items ADD COLUMN IF NOT EXISTS extra_deep BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE estimate_photos      ADD COLUMN IF NOT EXISTS stump_number INTEGER`,
    `ALTER TABLE messages  ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE`,
    `ALTER TABLE messages  ADD COLUMN IF NOT EXISTS job_id  INTEGER REFERENCES jobs(id)  ON DELETE CASCADE`,
    `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL`,
  ];

  for (const sql of patches) {
    try { await pool.query(sql); }
    catch (e) { console.warn('Patch skipped:', e.message.split('\n')[0]); }
  }
  console.log('Database schema ready.');
}

async function start() {
  await runMigration();
  app.listen(PORT, () => {
    console.log(`Stump Pros backend running on port ${PORT}`);
    startCronJobs();
  });
}

start();
