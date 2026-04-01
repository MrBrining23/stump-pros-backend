require('dotenv').config();
const express = require('express');
const cors = require('cors');

const leadsRouter = require('./routes/leads');
const jobsRouter = require('./routes/jobs');
const settingsRouter = require('./routes/settings');
const smsRouter = require('./routes/sms');
const { startCronJobs } = require('./services/cron');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/leads', leadsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/sms', smsRouter);

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
app.listen(PORT, () => {
  console.log(`Stump Pros backend running on port ${PORT}`);
  startCronJobs();
});
