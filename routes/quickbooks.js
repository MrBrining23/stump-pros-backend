const express = require('express');
const router = express.Router();
const OAuthClient = require('intuit-oauth');
const pool = require('../db/pool');

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    environment: process.env.QB_ENVIRONMENT || 'production',
    redirectUri: process.env.QB_REDIRECT_URI,
  });
}

// GET /api/quickbooks/auth — redirect to QuickBooks OAuth
router.get('/auth', (req, res) => {
  const oauthClient = getOAuthClient();
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'stumppros_qb_auth',
  });
  res.redirect(authUri);
});

// GET /api/quickbooks/callback — exchange code for tokens, save to DB
router.get('/callback', async (req, res) => {
  const oauthClient = getOAuthClient();
  try {
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();

    await pool.query(
      `UPDATE settings
       SET qb_access_token  = $1,
           qb_refresh_token = $2,
           qb_realm_id      = $3,
           qb_token_expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [token.access_token, token.refresh_token, token.realmId]
    );

    res.json({ success: true, realmId: token.realmId });
  } catch (err) {
    console.error('QB callback error:', err.message);
    res.status(500).json({ error: 'QB OAuth failed', detail: err.message });
  }
});

// Helper — load tokens from DB and refresh if needed
async function getValidToken() {
  const { rows } = await pool.query(
    'SELECT qb_access_token, qb_refresh_token, qb_realm_id, qb_token_expires_at FROM settings WHERE id = 1'
  );
  const s = rows[0];
  if (!s?.qb_access_token) throw new Error('QuickBooks not connected — visit /api/quickbooks/auth');

  const oauthClient = getOAuthClient();
  oauthClient.setToken({
    token_type: 'bearer',
    access_token: s.qb_access_token,
    refresh_token: s.qb_refresh_token,
    realmId: s.qb_realm_id,
  });

  // Refresh if within 5 minutes of expiry
  if (s.qb_token_expires_at && new Date(s.qb_token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await oauthClient.refresh();
    const t = refreshed.getJson();
    await pool.query(
      `UPDATE settings
       SET qb_access_token = $1, qb_refresh_token = $2,
           qb_token_expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [t.access_token, t.refresh_token]
    );
    oauthClient.setToken({ ...oauthClient.getToken(), access_token: t.access_token });
  }

  return { oauthClient, realmId: s.qb_realm_id };
}

// POST /api/quickbooks/invoice — create QB invoice for a job
router.post('/invoice', async (req, res) => {
  const { job_id } = req.body;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });

  try {
    const { oauthClient, realmId } = await getValidToken();
    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
    const headers = {
      Authorization: `Bearer ${oauthClient.getToken().access_token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const axios = require('axios');

    // Load job
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [job_id]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    const job = rows[0];

    // Find or create Customer by display name
    const customerName = job.customer_name;
    const searchRes = await axios.get(
      `${baseUrl}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}`,
      { headers }
    );
    let customerId;
    const existing = searchRes.data?.QueryResponse?.Customer;
    if (existing && existing.length > 0) {
      customerId = existing[0].Id;
    } else {
      const createRes = await axios.post(
        `${baseUrl}/customer`,
        {
          DisplayName: customerName,
          PrimaryPhone: job.phone ? { FreeFormNumber: job.phone } : undefined,
          PrimaryEmailAddr: job.email ? { Address: job.email } : undefined,
          BillAddr: job.address ? { Line1: job.address } : undefined,
        },
        { headers }
      );
      customerId = createRes.data.Customer.Id;
    }

    // Build invoice line items
    const description = [
      job.package ? `Package: ${job.package}` : null,
      job.stump_count ? `Stumps: ${job.stump_count}` : null,
      job.notes || null,
    ].filter(Boolean).join(' | ') || 'Stump removal services';

    const amount = parseFloat(job.amount) || 0;
    const invoicePayload = {
      CustomerRef: { value: customerId },
      Line: [
        {
          Amount: amount,
          DetailType: 'SalesItemLineDetail',
          Description: description,
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: 'Services' },
            UnitPrice: amount,
            Qty: 1,
          },
        },
      ],
    };

    const invoiceRes = await axios.post(`${baseUrl}/invoice`, invoicePayload, { headers });
    const invoice = invoiceRes.data.Invoice;

    res.json({
      success: true,
      invoice_id: invoice.Id,
      invoice_number: invoice.DocNumber,
      amount: invoice.TotalAmt,
      customer_id: customerId,
    });
  } catch (err) {
    console.error('QB invoice error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message, detail: err.response?.data });
  }
});

module.exports = router;
