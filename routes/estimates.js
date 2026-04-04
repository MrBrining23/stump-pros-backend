const express = require('express');
const estimatesRouter = express.Router();
const responseRouter = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { sendSMS } = require('../services/sms');

// POST /api/estimates — create & send estimate
estimatesRouter.post('/', async (req, res) => {
  const { job_id, customer_id, customer_name, phone, email, address, description, amount, notes, photos } = req.body;
  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO estimates (job_id, customer_id, customer_name, phone, email, address, description, amount, notes, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [job_id || null, customer_id || null, customer_name, phone || null, email || null,
       address || null, description || null, amount || null, notes || null,
       JSON.stringify(photos || [])]
    );
    const estimate = result.rows[0];

    if (phone) {
      try {
        const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
        const settings = settingsResult.rows[0] || {};
        const introMsg = (settings.estimate_intro_msg || 'Hi {name}, here is your estimate from Stump Pros WV:')
          .replace('{name}', customer_name);
        const link = `https://stump-pros-backend-production.up.railway.app/estimate/${estimate.approval_token}`;
        await sendSMS(phone, `${introMsg}\n${link}`);
        const updated = await pool.query(
          'UPDATE estimates SET sent_at = NOW() WHERE id = $1 RETURNING *',
          [estimate.id]
        );
        return res.json(updated.rows[0]);
      } catch (smsErr) {
        console.error('Failed to send estimate SMS:', smsErr.message);
      }
    }

    res.json(estimate);
  } catch (err) {
    console.error('POST /api/estimates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/estimates
estimatesRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estimates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/estimates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/estimates/:id
estimatesRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/estimates/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimates/:id/send-discount — manually push a discount offer
estimatesRouter.post('/:id/send-discount', async (req, res) => {
  try {
    const estResult = await pool.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    if (!estResult.rows.length) return res.status(404).json({ error: 'Not found' });
    const estimate = estResult.rows[0];

    const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsResult.rows[0] || {};
    const discountPct = settings.estimate_discount_pct || 10;
    const discountedAmount = Math.round(parseFloat(estimate.amount) * (1 - discountPct / 100) * 100) / 100;

    const updated = await pool.query(
      `UPDATE estimates
       SET status = 'discount_offered', discount_pct = $1, discounted_amount = $2
       WHERE id = $3 RETURNING *`,
      [discountPct, discountedAmount, estimate.id]
    );

    if (estimate.phone) {
      try {
        const discountMsg = (settings.estimate_discount_msg || "We'd still love to earn your business! Here's a special discounted offer just for you:")
          .replace('{name}', estimate.customer_name);
        const link = `https://stump-pros-backend-production.up.railway.app/estimate/${estimate.discount_token}`;
        await sendSMS(estimate.phone, `${discountMsg}\n$${discountedAmount} — ${link}`);
      } catch (smsErr) {
        console.error('Failed to send discount SMS:', smsErr.message);
      }
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('POST /api/estimates/:id/send-discount error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/estimates/:id
estimatesRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM estimates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/estimates/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUBLIC ESTIMATE RESPONSE ROUTES — mounted at /api/estimate-response
// ============================================================

// GET /api/estimate-response/:token — load by approval_token or discount_token
responseRouter.get('/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT customer_name, address, description, amount, discounted_amount, discount_pct, status, notes, photos
       FROM estimates
       WHERE approval_token = $1 OR discount_token = $1`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Estimate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/estimate-response/:token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimate-response/:token/approve — customer approves
responseRouter.post('/:token/approve', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE estimates SET status = 'approved', responded_at = NOW()
       WHERE approval_token = $1 AND status = 'pending'
       RETURNING id`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Estimate not found or not in pending state' });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/estimate-response/:token/approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimate-response/:token/decline — customer declines, auto-sends discount offer
responseRouter.post('/:token/decline', async (req, res) => {
  try {
    const estResult = await pool.query(
      `SELECT * FROM estimates WHERE approval_token = $1 AND status = 'pending'`,
      [req.params.token]
    );
    if (!estResult.rows.length) return res.status(404).json({ error: 'Estimate not found or not in pending state' });
    const estimate = estResult.rows[0];

    const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsResult.rows[0] || {};
    const discountPct = settings.estimate_discount_pct || 10;
    const discountedAmount = Math.round(parseFloat(estimate.amount) * (1 - discountPct / 100) * 100) / 100;

    await pool.query(
      `UPDATE estimates
       SET status = 'discount_offered', responded_at = NOW(),
           discount_pct = $1, discounted_amount = $2
       WHERE id = $3`,
      [discountPct, discountedAmount, estimate.id]
    );

    if (estimate.phone) {
      try {
        const discountMsg = (settings.estimate_discount_msg || 'We\'d still love to earn your business! Here\'s a special discounted offer just for you:')
          .replace('{name}', estimate.customer_name);
        const link = `https://stump-pros-backend-production.up.railway.app/estimate/${estimate.discount_token}`;
        await sendSMS(estimate.phone, `${discountMsg}\n$${discountedAmount} — ${link}`);
      } catch (smsErr) {
        console.error('Failed to send discount SMS:', smsErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/estimate-response/:token/decline error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimate-response/:token/approve-discount — customer approves discounted offer
responseRouter.post('/:token/approve-discount', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE estimates SET status = 'discount_approved', responded_at = NOW()
       WHERE discount_token = $1 AND status = 'discount_offered'
       RETURNING id`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Estimate not found or offer no longer active' });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/estimate-response/:token/approve-discount error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { estimatesRouter, responseRouter };
