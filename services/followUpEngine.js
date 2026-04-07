const pool = require('../db/pool');
const { sendSMS } = require('./sms');

/**
 * Schedule a follow-up drip sequence for a lead.
 * Cancels any existing pending follow-ups before scheduling new ones.
 */
async function scheduleFollowUps(leadId, sequenceName) {
  // Cancel any existing pending follow-ups for this lead
  await cancelFollowUps(leadId);

  const templates = await pool.query(
    'SELECT * FROM follow_up_templates WHERE sequence_name = $1 ORDER BY step_number',
    [sequenceName]
  );

  if (templates.rows.length === 0) {
    console.warn(`[FOLLOW-UP] No templates found for sequence: ${sequenceName}`);
    return;
  }

  const lead = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (lead.rows.length === 0) return;

  const leadData = lead.rows[0];
  const name = leadData.name ? leadData.name.split(' ')[0] : 'there';

  for (const template of templates.rows) {
    const message = template.message
      .replace(/\{\{name\}\}/g, name)
      .replace(/\{name\}/g, name);

    const scheduledAt = new Date(Date.now() + template.delay_hours * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO follow_ups (lead_id, template_id, sequence_name, step_number, message, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [leadId, template.id, sequenceName, template.step_number, message, scheduledAt]
    );
  }

  console.log(`[FOLLOW-UP] Scheduled ${templates.rows.length} follow-ups for lead #${leadId} (${sequenceName})`);
}

/**
 * Cancel all pending follow-ups for a lead.
 */
async function cancelFollowUps(leadId) {
  const result = await pool.query(
    `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW()
     WHERE lead_id = $1 AND status = 'pending'
     RETURNING id`,
    [leadId]
  );

  if (result.rows.length > 0) {
    console.log(`[FOLLOW-UP] Cancelled ${result.rows.length} pending follow-ups for lead #${leadId}`);
  }

  return result.rows.length;
}

/**
 * Process all pending follow-ups that are due.
 * Called by cron every 5 minutes.
 */
async function processPendingFollowUps() {
  try {
    // Get due follow-ups with lead info
    const result = await pool.query(
      `SELECT f.*, l.phone, l.status AS lead_status, l.name AS lead_name
       FROM follow_ups f
       JOIN leads l ON l.id = f.lead_id
       WHERE f.status = 'pending'
         AND f.scheduled_at <= NOW()
       ORDER BY f.scheduled_at`
    );

    if (result.rows.length === 0) return;

    console.log(`[FOLLOW-UP] Processing ${result.rows.length} due follow-up(s)...`);

    for (const followUp of result.rows) {
      // Skip if lead has responded, converted, or is lost
      if (['converted', 'lost'].includes(followUp.lead_status)) {
        await pool.query(
          `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
          [followUp.id]
        );
        console.log(`[FOLLOW-UP] Skipped #${followUp.id} — lead #${followUp.lead_id} is ${followUp.lead_status}`);
        continue;
      }

      if (!followUp.phone) {
        await pool.query(
          `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
          [followUp.id]
        );
        console.log(`[FOLLOW-UP] Skipped #${followUp.id} — no phone for lead #${followUp.lead_id}`);
        continue;
      }

      try {
        await sendSMS(followUp.phone, followUp.message);
        await pool.query(
          `UPDATE follow_ups SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [followUp.id]
        );
        console.log(`[FOLLOW-UP] Sent step ${followUp.step_number} (${followUp.sequence_name}) to lead #${followUp.lead_id}`);
      } catch (smsErr) {
        console.error(`[FOLLOW-UP] SMS failed for follow-up #${followUp.id}:`, smsErr.message);
        // Don't mark as sent — will retry next cron run
      }
    }
  } catch (err) {
    console.error('[FOLLOW-UP] Error processing pending follow-ups:', err.message);
  }
}

module.exports = { scheduleFollowUps, cancelFollowUps, processPendingFollowUps };
