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
const { estimatesRouter, responseRouter } = require('./routes/estimates');
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
app.use('/api/estimate-response', responseRouter);
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

function checkMetaConfig() {
  const missing = [];
  if (!process.env.META_WEBHOOK_VERIFY_TOKEN) missing.push('META_WEBHOOK_VERIFY_TOKEN');
  if (!process.env.META_PAGE_ACCESS_TOKEN) missing.push('META_PAGE_ACCESS_TOKEN');
  if (missing.length > 0) {
    console.warn(`⚠ Meta Lead Ads: missing env vars: ${missing.join(', ')} — webhook will NOT capture leads until configured.`);
  } else {
    console.log('Meta Lead Ads: configured.');
  }
}

async function start() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema ready.');
  } catch (err) {
    console.error('Database init error:', err);
  }
  app.listen(PORT, () => {
    console.log(`Stump Pros backend running on port ${PORT}`);
    checkMetaConfig();
    startCronJobs();
  });
}

start();
