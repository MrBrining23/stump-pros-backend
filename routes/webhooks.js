/**
 * Meta Lead Ads Webhook
 *
 * Railway environment variables required:
 *   META_WEBHOOK_VERIFY_TOKEN  — any secret string you choose (set the same value in Meta Business Suite)
 *   META_PAGE_ACCESS_TOKEN     — Facebook Page access token from Meta Business Suite
 *
 * Registering the webhook in Meta Business Suite:
 *   1. Go to Meta Business Suite → All Tools → Business Settings → Webhooks (or use developers.facebook.com)
 *   2. Choose "Page" as the object type and subscribe to the "leadgen" field
 *   3. Callback URL: https://stump-pros-backend-production.up.railway.app/api/webhooks/meta
 *   4. Verify Token: the value you set in META_WEBHOOK_VERIFY_TOKEN on Railway
 *   5. Click "Verify and Save" — Meta will call the GET endpoint to confirm
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const { sendSMS } = require('../services/sms');

// GET /api/webhooks/meta — Meta webhook verification
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('Meta webhook verified.');
    return res.status(200).send(challenge);
  }

  console.warn('Meta webhook verification failed. Check META_WEBHOOK_VERIFY_TOKEN.');
  return res.sendStatus(403);
});

// POST /api/webhooks/meta — receive lead events from Meta Lead Ads
router.post('/meta', async (req, res) => {
  // Respond 200 immediately — Meta requires a fast response
  res.sendStatus(200);

  try {
    const entry = req.body && req.body.entry && req.body.entry[0];
    const change = entry && entry.changes && entry.changes[0];
    const value = change && change.value;

    if (!value || change.field !== 'leadgen') {
      console.log('Meta webhook: non-leadgen event, skipping.');
      return;
    }

    const leadgenId = value.leadgen_id;
    if (!leadgenId) {
      console.warn('Meta webhook: missing leadgen_id in payload.');
      return;
    }

    // Fetch full lead data from Meta Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}`;
    const graphRes = await axios.get(graphUrl, {
      params: { access_token: process.env.META_PAGE_ACCESS_TOKEN },
    });

    const fieldData = graphRes.data.field_data || [];

    const get = (key) => {
      const field = fieldData.find((f) => f.name === key);
      return field && field.values && field.values[0] ? field.values[0] : null;
    };

    const firstName = get('first_name') || '';
    const lastName = get('last_name') || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    const phone = get('phone_number');
    const email = get('email');

    // Insert lead into DB
    const insertResult = await pool.query(
      `INSERT INTO leads (name, phone, email, source, status, auto_contacted)
       VALUES ($1, $2, $3, 'meta_ads', 'new', false)
       RETURNING *`,
      [name, phone, email]
    );
    const lead = insertResult.rows[0];
    console.log(`Meta lead captured: #${lead.id} — ${lead.name}`);

    // Auto-SMS if enabled in settings
    if (phone) {
      const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
      const settings = settingsResult.rows[0];

      if (settings && settings.auto_text) {
        try {
          const message = settings.auto_text.replace('{{name}}', firstName || name).replace('{name}', firstName || name);
          await sendSMS(phone, message);
          await pool.query(
            'UPDATE leads SET auto_contacted = true, auto_contacted_at = NOW() WHERE id = $1',
            [lead.id]
          );
          console.log(`Auto-SMS sent to Meta lead #${lead.id}`);
        } catch (smsErr) {
          console.error(`Auto-SMS failed for Meta lead #${lead.id}:`, smsErr.message);
          // Non-fatal — lead was saved, only SMS failed
        }
      }
    }
  } catch (err) {
    console.error('Meta webhook processing error:', err.message);
  }
});

module.exports = router;
