const express = require('express');
const router = express.Router();
const { sendSMS } = require('../services/sms');

// POST /api/sms/send
router.post('/send', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to and message are required' });
  }

  try {
    const result = await sendSMS(to, message);
    res.json({ success: true, result });
  } catch (err) {
    console.error('POST /api/sms/send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
