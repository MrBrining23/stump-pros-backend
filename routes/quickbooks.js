const express = require('express');
const router = express.Router();
const OAuthClient = require('intuit-oauth');
const pool = require('../db/pool');
const { getOAuthClient, getValidToken, createInvoiceForJob } = require('../services/quickbooks');

// GET /api/quickbooks/auth — redirect to QuickBooks OAuth
router.get('/auth', (req, res) => {
  const oauthClient = getOAuthClient();
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'stumppros_qb_auth',
  });
  res.redirect(authUri);
});

// GET /api/quickbooks/callback — exchange code for tokens, save to DB, redirect home
router.get('/callback', async (req, res) => {
  const oauthClient = getOAuthClient();
  try {
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();

    await pool.query(
      `UPDATE settings
       SET qb_access_token      = $1,
           qb_refresh_token     = $2,
           qb_realm_id          = $3,
           qb_token_expires_at  = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [token.access_token, token.refresh_token, token.realmId]
    );

    res.redirect('/');
  } catch (err) {
    console.error('QB callback error:', err.message);
    res.status(500).json({ error: 'QB OAuth failed', detail: err.message });
  }
});

// POST /api/quickbooks/invoice — create QB invoice for a job
router.post('/invoice', async (req, res) => {
  const { job_id, customer_name, phone, email, address, package: pkg, stump_count, amount, notes } = req.body;
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

// POST /api/quickbooks/refresh — manually refresh the QB access token
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
      token_type: 'bearer',
      access_token: s.qb_access_token,
      refresh_token: s.qb_refresh_token,
      realmId: s.qb_realm_id,
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

module.exports = router;
