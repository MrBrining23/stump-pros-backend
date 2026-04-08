/**
 * Webhooks for Meta Lead Ads and Quo (OpenPhone) inbound SMS
 *
 * Railway environment variables required:
 *   META_WEBHOOK_VERIFY_TOKEN  — any secret string you choose (set the same value in Meta Business Suite)
 *   META_PAGE_ACCESS_TOKEN     — Facebook Page access token from Meta Business Suite
 *   QUO_API_KEY                — OpenPhone API key (for SMS sending)
 *   STUMP_PROS_PHONE           — OpenPhone phone number ID
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db/pool');
const { sendSMS } = require('../services/sms');
const { scheduleFollowUps, cancelFollowUps } = require('../services/followUpEngine');

// ──────────────────────────────────────────
// META LEAD ADS WEBHOOK
// ──────────────────────────────────────────

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

// GET /api/webhooks/meta/status — check Meta webhook configuration
router.get('/meta/status', (req, res) => {
  const hasVerifyToken = !!process.env.META_WEBHOOK_VERIFY_TOKEN;
  const hasPageToken = !!process.env.META_PAGE_ACCESS_TOKEN;
  const configured = hasVerifyToken && hasPageToken;

  res.json({
    configured,
    verify_token: hasVerifyToken ? 'set' : 'MISSING',
    page_access_token: hasPageToken ? 'set' : 'MISSING',
    webhook_url: '/api/webhooks/meta',
    message: configured
      ? 'Meta Lead Ads webhook is configured and ready.'
      : 'Missing environment variables — set them in Railway dashboard.',
  });
});

// POST /api/webhooks/meta — receive lead events from Meta Lead Ads
router.post('/meta', async (req, res) => {
  // Respond 200 immediately — Meta requires a fast response
  res.sendStatus(200);

  try {
    if (!process.env.META_PAGE_ACCESS_TOKEN) {
      console.error('META ERROR: META_PAGE_ACCESS_TOKEN is not set — cannot fetch lead data. Set it in Railway env vars.');
      return;
    }

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

    // Fetch full lead data from Meta Graph API v21.0
    const graphUrl = `https://graph.facebook.com/v21.0/${leadgenId}`;
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
    const stumpCount = get('stump_count') || get('how_many_stumps');
    const timeline = get('timeline') || get('when_do_you_need_this_done');
    const homeowner = get('are_you_the_homeowner') || get('homeowner');

    // Build notes from custom form fields
    const noteParts = [];
    if (stumpCount) noteParts.push(`Stumps: ${stumpCount}`);
    if (timeline) noteParts.push(`Timeline: ${timeline}`);
    if (homeowner) noteParts.push(`Homeowner: ${homeowner}`);
    const notes = noteParts.length > 0 ? noteParts.join(' | ') : null;

    // Insert lead into DB
    const insertResult = await pool.query(
      `INSERT INTO leads (name, phone, email, source, status, auto_contacted, stump_count, notes)
       VALUES ($1, $2, $3, 'meta_ads', 'new', false, $4, $5)
       RETURNING *`,
      [name, phone, email, stumpCount ? parseInt(stumpCount, 10) || null : null, notes]
    );
    const lead = insertResult.rows[0];
    console.log(`Meta lead captured: #${lead.id} — ${lead.name}`);

    // Auto-SMS if enabled in settings
    if (phone) {
      const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
      const settings = settingsResult.rows[0];

      if (settings && settings.auto_text) {
        try {
          const message = settings.auto_text
            .replace(/\{\{name\}\}/g, firstName || name)
            .replace(/\{name\}/g, firstName || name);
          await sendSMS(phone, message);
          await pool.query(
            'UPDATE leads SET auto_contacted = true, auto_contacted_at = NOW() WHERE id = $1',
            [lead.id]
          );
          console.log(`Auto-SMS sent to Meta lead #${lead.id}`);
        } catch (smsErr) {
          console.error(`Auto-SMS failed for Meta lead #${lead.id}:`, smsErr.message);
        }
      }

      // Schedule no_response follow-up drip
      try {
        await scheduleFollowUps(lead.id, 'no_response');
      } catch (fuErr) {
        console.error(`Failed to schedule follow-ups for lead #${lead.id}:`, fuErr.message);
      }
    }
  } catch (err) {
    console.error('Meta webhook processing error:', err.message);
  }
});

// ──────────────────────────────────────────
// QUO (OPENPHONE) INBOUND SMS WEBHOOK
// ──────────────────────────────────────────

/**
 * Normalize a phone number to digits only for matching.
 * +1(304) 555-1234 → 13045551234
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// POST /api/webhooks/quo — receive inbound SMS from OpenPhone
router.post('/quo', async (req, res) => {
  res.sendStatus(200);

  try {
    const data = req.body.data || req.body;
    const object = data.object || data;

    // OpenPhone sends from/to and body in the message object
    const from = object.from || data.from;
    const body = object.body || object.content || data.body || '';

    if (!from) {
      console.log('[WEBHOOK] Quo inbound: no from number, skipping.');
      return;
    }

    const normalizedFrom = normalizePhone(from);
    console.log(`[WEBHOOK] Inbound SMS from ${from}: ${body}`);

    // Find matching lead by normalized phone
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    const matchedLead = result.rows.find((lead) => {
      return normalizePhone(lead.phone) === normalizedFrom;
    });

    if (!matchedLead) {
      console.log(`[WEBHOOK] No lead found matching phone ${from}`);
      return;
    }

    // Cancel pending follow-ups for this lead
    const cancelled = await cancelFollowUps(matchedLead.id);
    if (cancelled > 0) {
      console.log(`[WEBHOOK] Follow-ups cancelled for lead #${matchedLead.id} (customer responded)`);
    }
  } catch (err) {
    console.error('[WEBHOOK] Quo inbound processing error:', err.message);
  }
});

module.exports = router;
