const cron = require('node-cron');
const pool = require('../db/pool');
const { sendSMS } = require('./sms');

function startCronJobs() {
  // Every hour: check for completed jobs that need a review request SMS
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking for review request candidates...');
    try {
      const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
      const settings = settingsResult.rows[0];

      if (!settings || !settings.google_review_url) {
        console.log('[CRON] No google_review_url set, skipping review requests.');
        return;
      }

      const reviewDelay = settings.review_delay || 24;

      const result = await pool.query(
        `SELECT * FROM jobs
         WHERE status = 'completed'
           AND review_sent = FALSE
           AND completed_at IS NOT NULL
           AND completed_at <= NOW() - INTERVAL '${reviewDelay} hours'
           AND phone IS NOT NULL`
      );

      console.log(`[CRON] Found ${result.rows.length} job(s) eligible for review request.`);

      for (const job of result.rows) {
        const message = `Hi ${job.customer_name}, thanks for choosing Stump Pros WV! We'd love a review: ${settings.google_review_url}`;
        try {
          await sendSMS(job.phone, message);
          await pool.query(
            'UPDATE jobs SET review_sent = TRUE WHERE id = $1',
            [job.id]
          );
          console.log(`[CRON] Review SMS sent to job #${job.id} (${job.phone})`);
        } catch (smsErr) {
          console.error(`[CRON] Failed to send review SMS for job #${job.id}:`, smsErr.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Error in review request cron:', err.message);
    }
  });

  console.log('[CRON] Jobs scheduled.');
}

module.exports = { startCronJobs };
