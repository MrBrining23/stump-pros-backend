const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { sendSMS } = require('../services/sms');
const { scheduleFollowUps, cancelFollowUps } = require('../services/followUpEngine');

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

      // Schedule no_response follow-up drip
      try {
        await scheduleFollowUps(lead.id, 'no_response');
      } catch (fuErr) {
        console.error('Failed to schedule follow-ups for lead #' + lead.id + ':', fuErr.message);
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

    const lead = result.rows[0];

    // Schedule quoted_not_booked drip when status changes to quoted
    if (status === 'quoted') {
      try {
        await scheduleFollowUps(lead.id, 'quoted_not_booked');
      } catch (fuErr) {
        console.error('Failed to schedule follow-ups for lead #' + lead.id + ':', fuErr.message);
      }
    }

    // Cancel follow-ups if lead is lost
    if (status === 'lost') {
      try {
        await cancelFollowUps(lead.id);
      } catch (fuErr) {
        console.error('Failed to cancel follow-ups for lead #' + lead.id + ':', fuErr.message);
      }
    }

    res.json(lead);
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

    // Cancel all pending follow-ups on conversion
    try {
      await cancelFollowUps(lead.id);
    } catch (fuErr) {
      console.error('Failed to cancel follow-ups for lead #' + lead.id + ':', fuErr.message);
    }

    res.status(201).json(job);
  } catch (err) {
    console.error('POST /api/leads/:id/convert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id — edit lead fields
router.patch('/:id', async (req, res) => {
  const { name, phone, email, address, source, contact_preference, stump_count, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE leads SET
        name               = COALESCE($1, name),
        phone              = COALESCE($2, phone),
        email              = COALESCE($3, email),
        address            = COALESCE($4, address),
        source             = COALESCE($5, source),
        contact_preference = COALESCE($6, contact_preference),
        stump_count        = COALESCE($7, stump_count),
        notes              = COALESCE($8, notes)
       WHERE id = $9 RETURNING *`,
      [name, phone, email, address, source, contact_preference, stump_count || null, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/leads/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/leads/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/convert-to-customer — create a customer record from this lead
router.post('/:id/convert-to-customer', async (req, res) => {
  const leadId = req.params.id;
  try {
    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    // Insert into customers (skip if already exists by name+phone)
    const customerResult = await pool.query(
      `INSERT INTO customers (name, phone, email, address, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [lead.name, lead.phone, lead.email, lead.address, lead.notes, lead.source || 'lead']
    );

    // If ON CONFLICT fired, fetch the existing customer
    let customer;
    if (customerResult.rows.length > 0) {
      customer = customerResult.rows[0];
    } else {
      const existing = await pool.query(
        `SELECT * FROM customers WHERE lower(name) = lower($1) AND (phone = $2 OR ($2 IS NULL AND phone IS NULL)) LIMIT 1`,
        [lead.name, lead.phone]
      );
      customer = existing.rows[0];
    }

    // Mark lead as converted and cancel follow-ups
    await pool.query('UPDATE leads SET status = $1 WHERE id = $2', ['converted', leadId]);
    try { await cancelFollowUps(leadId); } catch (_) {}

    res.status(201).json({ customer });
  } catch (err) {
    console.error('POST /api/leads/:id/convert-to-customer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id/follow-ups
router.get('/:id/follow-ups', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY step_number',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/leads/:id/follow-ups error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
