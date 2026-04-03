const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { createInvoiceForJob } = require('../services/quickbooks');

// GET /api/jobs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/jobs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/jobs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs
router.post('/', async (req, res) => {
  const {
    lead_id, customer_name, phone, email, address,
    package: pkg, stump_count, notes,
    scheduled_date, scheduled_time, amount
  } = req.body;

  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO jobs
         (lead_id, customer_name, phone, email, address, package, stump_count, notes, scheduled_date, scheduled_time, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [lead_id, customer_name, phone, email, address, pkg, stump_count, notes, scheduled_date, scheduled_time, amount]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/jobs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    let query, params;

    if (status === 'completed') {
      query = 'UPDATE jobs SET status = $1, completed_at = NOW() WHERE id = $2 RETURNING *';
      params = [status, req.params.id];
    } else {
      query = 'UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *';
      params = [status, req.params.id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = result.rows[0];

    // Auto-create QB invoice when job is marked as invoiced
    if (status === 'invoiced') {
      createInvoiceForJob(job.id).then(invoice => {
        console.log(`QB invoice created for job ${job.id}: invoice #${invoice.invoice_id}`);
      }).catch(err => {
        console.error(`QB auto-invoice failed for job ${job.id}:`, err.message);
      });
    }

    res.json(job);
  } catch (err) {
    console.error('PATCH /api/jobs/:id/status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:id/invoice — manual QB invoice trigger
router.post('/:id/invoice', async (req, res) => {
  const jobId = req.params.id;
  try {
    const result = await createInvoiceForJob(jobId);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message.includes('not connected')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`POST /api/jobs/${jobId}/invoice error:`, err.Fault || err.message);
    res.status(500).json({ error: err.message, detail: err.Fault });
  }
});

module.exports = router;
