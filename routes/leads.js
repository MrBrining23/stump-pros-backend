const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { sendSMS } = require('../services/sms');

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/leads/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  const { name, phone, email, address, source, contact_pref, stump_count, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO leads (name, phone, email, address, source, contact_pref, stump_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, phone, email, address, source || 'website', contact_pref || 'call', stump_count, notes]
    );
    const lead = result.rows[0];

    // Auto-SMS if phone is available
    if (phone) {
      try {
        const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
        const settings = settingsResult.rows[0];
        if (settings && settings.auto_text) {
          const firstName = name.split(' ')[0];
          const message = settings.auto_text.replace('{{name}}', firstName).replace('{name}', firstName);
          await sendSMS(phone, message);
          await pool.query(
            'UPDATE leads SET auto_contacted = TRUE, auto_contacted_at = NOW() WHERE id = $1',
            [lead.id]
          );
          lead.auto_contacted = true;
          lead.auto_contacted_at = new Date();
        }
      } catch (smsErr) {
        console.error('Auto-SMS failed for lead #' + lead.id + ':', smsErr.message);
        // Non-fatal — lead was created, just SMS failed
      }
    }

    res.status(201).json(lead);
  } catch (err) {
    console.error('POST /api/leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await pool.query(
      'UPDATE leads SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/leads/:id/status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/convert
router.post('/:id/convert', async (req, res) => {
  const leadId = req.params.id;

  try {
    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    const jobResult = await pool.query(
      `INSERT INTO jobs (lead_id, customer_name, phone, email, address, stump_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [lead.id, lead.name, lead.phone, lead.email, lead.address, lead.stump_count, lead.notes]
    );
    const job = jobResult.rows[0];

    await pool.query('UPDATE leads SET status = $1 WHERE id = $2', ['converted', leadId]);

    res.status(201).json(job);
  } catch (err) {
    console.error('POST /api/leads/:id/convert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
