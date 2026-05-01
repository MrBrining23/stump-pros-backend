const express = require('express');
const router = express.Router();
const OAuthClient = require('intuit-oauth');
const pool = require('../db/pool');
const { getOAuthClient, createInvoiceForJob } = require('../services/quickbooks');
const qb  = require('../services/quickbooksService');
const sms = require('../services/sms');

// ============================================================
// LEGACY OAUTH  (intuit-oauth library, tokens in settings table)
// ============================================================

// GET /api/quickbooks/auth — redirect to QB OAuth (legacy path)
router.get('/auth', (req, res) => {
  const oauthClient = getOAuthClient();
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'stumppros_qb_auth',
  });
  res.redirect(authUri);
});

// POST /api/quickbooks/invoice — create QB invoice for a job (legacy)
router.post('/invoice', async (req, res) => {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });
  try {
    const result = await createInvoiceForJob(job_id);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message.includes('not connected')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('QB invoice error:', err.Fault || err.message);
    res.status(500).json({ error: err.message, detail: err.Fault });
  }
});

// POST /api/quickbooks/refresh — manually refresh token (legacy)
router.post('/refresh', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT qb_access_token, qb_refresh_token, qb_realm_id FROM settings WHERE id = 1'
    );
    const s = rows[0];
    if (!s?.qb_refresh_token) {
      return res.status(400).json({ error: 'QuickBooks not connected — visit /api/quickbooks/auth' });
    }
    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      token_type:    'bearer',
      access_token:  s.qb_access_token,
      refresh_token: s.qb_refresh_token,
      realmId:       s.qb_realm_id,
    });
    const refreshed = await oauthClient.refresh();
    const t = refreshed.getJson();
    await pool.query(
      `UPDATE settings
       SET qb_access_token     = $1,
           qb_refresh_token    = $2,
           qb_token_expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [t.access_token, t.refresh_token]
    );
    res.json({ success: true, message: 'QB token refreshed' });
  } catch (err) {
    console.error('QB refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// NEW OAUTH  (fetch-based service, tokens in oauth_tokens table)
// ============================================================

// GET /api/quickbooks/connect — redirect to QB OAuth
router.get('/connect', (req, res) => {
  res.redirect(qb.getAuthUrl());
});

// GET /api/quickbooks/callback — exchange auth code for tokens
// Writes to both oauth_tokens (new service) AND settings (legacy compatibility)
router.get('/callback', async (req, res) => {
  const { code, realmId } = req.query;
  if (!code) return res.status(400).send('No code received');
  try {
    const tokens = await qb.exchangeCode(code);

    // Persist in oauth_tokens table
    await qb.saveTokens({ ...tokens, realm_id: realmId });

    // Mirror into settings so the legacy service keeps working
    await pool.query(
      `UPDATE settings
       SET qb_access_token     = $1,
           qb_refresh_token    = $2,
           qb_realm_id         = $3,
           qb_token_expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [tokens.access_token, tokens.refresh_token, realmId]
    );

    res.send('<h2 style="font-family:sans-serif;padding:40px">✅ QuickBooks connected! You can close this tab.</h2>');
  } catch (err) {
    console.error('QB callback error:', err.message);
    res.status(500).send(`Connection failed: ${err.message}`);
  }
});

// GET /api/quickbooks/status — check whether QB is authorised
router.get('/status', async (req, res) => {
  try {
    const tokens = await qb.getTokens();
    res.json({ connected: !!tokens?.access_token, realm_id: tokens?.realm_id || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAYMENT ACTIONS
// ============================================================

// POST /api/quickbooks/jobs/:jobId/request-payment
// Creates a QB Invoice and texts the payment link to the customer
router.post('/jobs/:jobId/request-payment', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.*,
              e.notes AS estimate_notes,
              COALESCE(
                json_agg(ei ORDER BY ei.stump_number)
                  FILTER (WHERE ei.id IS NOT NULL),
                '[]'
              ) AS stump_items
       FROM jobs j
       LEFT JOIN estimates e             ON e.id = j.estimate_id
       LEFT JOIN estimate_stump_items ei ON ei.estimate_id = j.estimate_id
       WHERE j.id = $1
       GROUP BY j.id, e.notes`,
      [req.params.jobId]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Build line items from stump detail rows, falling back to job total
    let lineItems;
    if (job.stump_items?.length > 0) {
      lineItems = job.stump_items.map(s => ({
        description: `Stump #${s.stump_number} — ${s.diameter_inches}" diameter`,
        total: parseFloat(s.subtotal),
      }));
    } else {
      lineItems = [{
        description: 'Stump grinding service',
        total: parseFloat(job.amount) || 0,
      }];
    }

    const invoice = await qb.createInvoice({
      customerName: job.customer_name,
      phone:        job.phone,
      email:        job.email,
      address:      job.address,
      lineItems,
      notes: job.notes,
    });

    const paymentLink = qb.getInvoiceLink(invoice);

    // Append QB invoice reference to job notes
    await pool.query(
      `UPDATE jobs
       SET notes      = COALESCE(notes, '') || $1,
           updated_at = NOW()
       WHERE id = $2`,
      [`\n[QB Invoice #${invoice.Id}]`, req.params.jobId]
    );

    // SMS the payment link to the customer
    if (job.phone) {
      const firstName = (job.customer_name || '').split(' ')[0];
      const total     = parseFloat(job.amount || 0).toFixed(2);
      const msg = `Hi ${firstName}! Your Stump Pros WV job is complete 🌲 Total: $${total}. Pay securely here: ${paymentLink}`;
      await sms.sendSMS(job.phone, msg);
    }

    res.json({ success: true, invoice_id: invoice.Id, payment_link: paymentLink });
  } catch (err) {
    console.error('QB payment request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/jobs/:jobId/mark-paid
// Creates a QB Sales Receipt for a cash or check payment
router.post('/jobs/:jobId/mark-paid', async (req, res) => {
  const { payment_method = 'cash', send_receipt = false } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT j.*,
              COALESCE(
                json_agg(ei ORDER BY ei.stump_number)
                  FILTER (WHERE ei.id IS NOT NULL),
                '[]'
              ) AS stump_items
       FROM jobs j
       LEFT JOIN estimates e             ON e.id = j.estimate_id
       LEFT JOIN estimate_stump_items ei ON ei.estimate_id = j.estimate_id
       WHERE j.id = $1
       GROUP BY j.id`,
      [req.params.jobId]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let lineItems;
    if (job.stump_items?.length > 0) {
      lineItems = job.stump_items.map(s => ({
        description: `Stump #${s.stump_number} — ${s.diameter_inches}" diameter`,
        total: parseFloat(s.subtotal),
      }));
    } else {
      lineItems = [{
        description: 'Stump grinding service',
        total: parseFloat(job.amount) || 0,
      }];
    }

    const receipt = await qb.createSalesReceipt({
      customerName:  job.customer_name,
      phone:         job.phone,
      email:         job.email,
      address:       job.address,
      lineItems,
      paymentMethod: payment_method,
      notes:         job.notes,
    });

    // Mark job completed
    await pool.query(
      `UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [req.params.jobId]
    );

    // Optional receipt SMS
    if (send_receipt && job.phone) {
      const firstName = (job.customer_name || '').split(' ')[0];
      const total     = parseFloat(job.amount || 0).toFixed(2);
      const msg = `Hi ${firstName}! Thanks for your payment of $${total} to Stump Pros WV. Receipt #${receipt.Id}. Appreciate your business! 🌲`;
      await sms.sendSMS(job.phone, msg);
    }

    res.json({ success: true, receipt_id: receipt.Id });
  } catch (err) {
    console.error('QB mark-paid error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
