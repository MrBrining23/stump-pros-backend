const axios = require('axios');

const OPENPHONE_BASE = 'https://api.openphone.com/v1';

async function sendSMS(to, message) {
  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.STUMP_PROS_PHONE;

  if (!apiKey || !from) {
    throw new Error('Missing QUO_API_KEY or STUMP_PROS_PHONE environment variables');
  }

  const response = await axios.post(
    `${OPENPHONE_BASE}/messages`,
    {
      from,
      to,
      content: message,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

module.exports = { sendSMS };
