#!/usr/bin/env node
/**
 * scripts/setup-webhooks.js — Stump Pros WV
 *
 * Run this ONCE after deploying to wire up:
 *   1. Meta webhook subscription (requires META_PAGE_ACCESS_TOKEN in env)
 *   2. Prints Quo webhook setup instructions (manual — no API for this)
 *
 * Usage:
 *   node scripts/setup-webhooks.js
 *
 * Prerequisites:
 *   - META_PAGE_ACCESS_TOKEN must be set in Railway environment
 *   - APP is deployed at APP_URL
 */

require('dotenv').config();

const META_PAGE_ID      = '100089985896147';
const META_APP_ID       = '1475203834008370';
const APP_URL           = process.env.APP_URL || 'https://stump-pros-backend-production.up.railway.app';
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN      = process.env.META_WEBHOOK_VERIFY_TOKEN;

// ── ANSI colors for terminal output ────────────────────────────────────
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';
const ok     = msg => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn   = msg => console.log(`${YELLOW}⚠${RESET}  ${msg}`);
const err    = msg => console.log(`${RED}✗${RESET} ${msg}`);
const head   = msg => console.log(`\n${BOLD}${msg}${RESET}`);

async function main() {
  console.log(`\n${BOLD}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD} Stump Pros WV — Webhook Setup Script${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════${RESET}`);

  // ── 1. Check env vars ─────────────────────────────────────────────────
  head('Step 1: Environment Variables');
  let hasErrors = false;

  if (!PAGE_ACCESS_TOKEN) {
    err('META_PAGE_ACCESS_TOKEN is not set.');
    console.log(`\n  To get your token:\n`);
    console.log(`  1. Go to: https://developers.facebook.com/tools/explorer/`);
    console.log(`  2. Select your app: StumpProsApp (${META_APP_ID})`);
    console.log(`  3. Click "Generate Access Token" with these permissions:`);
    console.log(`       pages_show_list, pages_manage_metadata,`);
    console.log(`       leads_retrieval, pages_read_engagement, ads_management`);
    console.log(`  4. Exchange for long-lived token:`);
    console.log(`\n     curl "https://graph.facebook.com/v21.0/oauth/access_token?\\`);
    console.log(`       grant_type=fb_exchange_token&\\`);
    console.log(`       client_id=${META_APP_ID}&\\`);
    console.log(`       client_secret=YOUR_APP_SECRET&\\`);
    console.log(`       fb_exchange_token=SHORT_LIVED_TOKEN_HERE"`);
    console.log(`\n  5. Get permanent page token:`);
    console.log(`\n     curl "https://graph.facebook.com/v21.0/${META_PAGE_ID}?\\`);
    console.log(`       fields=access_token&access_token=LONG_LIVED_TOKEN_HERE"`);
    console.log(`\n  6. Set in Railway:`);
    console.log(`     railway variables set META_PAGE_ACCESS_TOKEN=<the token>`);
    hasErrors = true;
  } else {
    ok('META_PAGE_ACCESS_TOKEN is set');
  }

  if (!VERIFY_TOKEN) {
    err('META_WEBHOOK_VERIFY_TOKEN is not set.');
    console.log('  Run: railway variables set META_WEBHOOK_VERIFY_TOKEN=stump-pros-wv-verify-2026');
    hasErrors = true;
  } else {
    ok(`META_WEBHOOK_VERIFY_TOKEN is set`);
  }

  if (hasErrors) {
    console.log(`\n${RED}Fix the above issues, then re-run this script.${RESET}\n`);
    process.exit(1);
  }

  // ── 2. Verify token works ─────────────────────────────────────────────
  head('Step 2: Verify Meta Token');
  try {
    const res  = await fetch(`https://graph.facebook.com/v21.0/${META_PAGE_ID}?fields=name,id&access_token=${PAGE_ACCESS_TOKEN}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    ok(`Token valid — Page: "${data.name}" (${data.id})`);
  } catch (e) {
    err(`Token verification failed: ${e.message}`);
    console.log('  Your META_PAGE_ACCESS_TOKEN may be expired or have wrong permissions.');
    process.exit(1);
  }

  // ── 3. Subscribe webhook ──────────────────────────────────────────────
  head('Step 3: Subscribe Meta Webhook');
  const webhookUrl = `${APP_URL}/api/webhooks/meta`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PAGE_ID}/subscribed_apps`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: 'leadgen',
          access_token:      PAGE_ACCESS_TOKEN,
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (data.success) {
      ok(`Page webhook subscribed to "leadgen" field`);
    } else {
      warn(`Unexpected response: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    err(`Webhook subscription failed: ${e.message}`);
    console.log(`\n  Fallback — do this manually in Meta for Developers:`);
    console.log(`  1. https://developers.facebook.com/apps/${META_APP_ID}`);
    console.log(`  2. Products → Webhooks → Page → Subscribe`);
    console.log(`  3. Callback URL:  ${webhookUrl}`);
    console.log(`  4. Verify token:  ${VERIFY_TOKEN}`);
    console.log(`  5. Field:         leadgen`);
  }

  // ── 4. Test webhook endpoint ──────────────────────────────────────────
  head('Step 4: Test Webhook Verification Endpoint');
  try {
    const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;
    const res = await fetch(testUrl);
    const body = await res.text();
    if (body === 'test123') {
      ok(`Webhook verification endpoint is responding correctly`);
    } else {
      warn(`Unexpected response from webhook endpoint: "${body}"`);
      console.log('  Check that your app is deployed and META_WEBHOOK_VERIFY_TOKEN matches.');
    }
  } catch (e) {
    err(`Could not reach webhook endpoint: ${e.message}`);
    console.log(`  URL tested: ${webhookUrl}`);
    console.log('  Make sure the app is deployed and running.');
  }

  // ── 5. Quo webhook instructions ───────────────────────────────────────
  head('Step 5: Quo (OpenPhone) Webhook Setup');
  console.log(`\n  Quo doesn't have an API to register webhooks — do this in their dashboard:\n`);
  console.log(`  1. Log into app.openphone.com`);
  console.log(`  2. Settings (gear icon) → Integrations → Webhooks`);
  console.log(`  3. Click "Add webhook"`);
  console.log(`  4. URL:    ${APP_URL}/api/webhooks/quo`);
  console.log(`  5. Events: Check "Message received" (message.received)`);
  console.log(`  6. Save`);
  console.log(`\n  ${YELLOW}Why this matters:${RESET} When a customer texts back, this cancels`);
  console.log(`  their pending follow-up drip sequence automatically.\n`);

  // ── 6. Add STUMP_PROS_OWNER_PHONE if missing ──────────────────────────
  head('Step 6: Owner Notification Phone');
  if (!process.env.STUMP_PROS_OWNER_PHONE) {
    warn('STUMP_PROS_OWNER_PHONE is not set.');
    console.log('  This is your cell number — used to SMS you when estimates are approved/rejected.');
    console.log('  Run: railway variables set STUMP_PROS_OWNER_PHONE=+13047122005');
  } else {
    ok(`Owner phone set: ${process.env.STUMP_PROS_OWNER_PHONE}`);
  }

  // ── Done ──────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${GREEN}══════════════════════════════════${RESET}`);
  console.log(`${BOLD}${GREEN} Setup complete!${RESET}`);
  console.log(`${BOLD}${GREEN}══════════════════════════════════${RESET}`);
  console.log(`\n  Backend:  ${APP_URL}`);
  console.log(`  Webhook:  ${webhookUrl}`);
  console.log(`\n  When a customer fills out a Meta Lead Ad form:`);
  console.log(`  Meta → POST ${APP_URL}/api/webhooks/meta`);
  console.log(`  → Lead saved → Auto-SMS sent → Follow-up drip scheduled\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
