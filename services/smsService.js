/**
 * services/smsService.js — thin shim over sms.js
 * The new estimates.js requires 'smsService', which re-exports from the
 * existing sms.js that uses the Quo/OpenPhone API.
 */
module.exports = require('./sms');
