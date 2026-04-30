/**
 * services/pricingEngine.js — Stump Pros WV
 *
 * Loads pricing config from DB settings table and calculates job totals.
 *
 * Config keys (all stored in settings table):
 *   price_per_inch         — base price per inch of diameter ($5.00)
 *   min_charge_per_stump   — minimum per individual stump ($50.00)
 *   min_charge_per_job     — minimum total job charge ($225.00)
 *   difficulty_multipliers — JSON object of difficulty → multiplier
 *   access_multipliers     — JSON object of access → multiplier
 *   depth_multipliers      — JSON object of depth → multiplier
 *   cleanup_multipliers    — JSON object of cleanup → multiplier
 */

const pool = require('../db/pool');

const DEFAULTS = {
  price_per_inch:         5.00,
  min_charge_per_stump:   50.00,
  min_charge_per_job:     225.00,
  difficulty_multipliers: { normal: 1.0, hard: 1.25, very_dense: 1.5 },
  access_multipliers:     { open: 1.0, limited: 1.25, very_limited: 1.5 },
  depth_multipliers:      { standard: 1.0, extra_deep: 1.25 },
  cleanup_multipliers:    { none: 1.0, chips_only: 1.5, full_cleanup: 2.0 },
};

const LABELS = {
  difficulty: { normal: 'Normal', hard: 'Hard Wood', very_dense: 'Very Dense' },
  access:     { open: 'Open Access', limited: 'Limited Access', very_limited: 'Very Limited Access' },
  depth:      { standard: 'Standard Depth', extra_deep: 'Extra Deep' },
  cleanup:    { none: 'Chips Left', chips_only: 'Chips Removed', full_cleanup: 'Full Cleanup' },
};

/**
 * Load pricing configuration from the settings table.
 * Falls back to defaults for any missing keys.
 */
async function loadPricingConfig() {
  try {
    const keys = [
      'price_per_inch', 'min_charge_per_stump', 'min_charge_per_job',
      'difficulty_multipliers', 'access_multipliers', 'depth_multipliers', 'cleanup_multipliers',
    ];
    const { rows } = await pool.query(
      `SELECT key, value FROM pricing_config WHERE key = ANY($1)`,
      [keys]
    );

    const config = { ...DEFAULTS };
    for (const row of rows) {
      if (row.key.endsWith('_multipliers')) {
        try { config[row.key] = JSON.parse(row.value); } catch (_) { /* keep default */ }
      } else {
        const n = parseFloat(row.value);
        if (!isNaN(n)) config[row.key] = n;
      }
    }
    return config;
  } catch (_) {
    // If settings table not yet available, use defaults
    return { ...DEFAULTS };
  }
}

/**
 * Calculate pricing for an array of stumps.
 *
 * @param {Array<{
 *   diameter_inches: number,
 *   difficulty?: string,
 *   access?: string,
 *   depth?: string,
 *   cleanup?: string,
 *   notes?: string
 * }>} stumps
 * @param {object} config  Result of loadPricingConfig()
 *
 * @returns {{
 *   stumps: Array<stump + base_price + subtotal + stump_number>,
 *   stump_subtotal: number,
 *   job_total: number,
 *   job_minimum_applied: boolean,
 * }}
 */
function calculateJob(stumps, config) {
  const {
    price_per_inch:         pricePerInch,
    min_charge_per_stump:   minPerStump,
    min_charge_per_job:     minPerJob,
    difficulty_multipliers: diffMult,
    access_multipliers:     accessMult,
    depth_multipliers:      depthMult,
    cleanup_multipliers:    cleanupMult,
  } = config;

  const priced = stumps.map((s, i) => {
    const diameter = parseFloat(s.diameter_inches) || 0;
    const diff     = s.difficulty || 'normal';
    const access   = s.access     || 'open';
    const depth    = s.depth      || 'standard';
    const cleanup  = s.cleanup    || 'none';

    const base_price = Math.max(
      diameter * pricePerInch,
      minPerStump
    );

    const multiplier =
      (diffMult[diff]     || 1.0) *
      (accessMult[access] || 1.0) *
      (depthMult[depth]   || 1.0) *
      (cleanupMult[cleanup] || 1.0);

    const subtotal = Math.round(base_price * multiplier * 100) / 100;

    return {
      ...s,
      stump_number:    i + 1,
      diameter_inches: diameter,
      difficulty:      diff,
      access:          access,
      depth:           depth,
      cleanup:         cleanup,
      base_price:      Math.round(base_price * 100) / 100,
      subtotal,
    };
  });

  const stump_subtotal = Math.round(priced.reduce((sum, s) => sum + s.subtotal, 0) * 100) / 100;
  const job_minimum_applied = stump_subtotal < minPerJob;
  const job_total = job_minimum_applied ? minPerJob : stump_subtotal;

  return { stumps: priced, stump_subtotal, job_total, job_minimum_applied };
}

/**
 * Format a number as a dollar string, e.g. 225 → "$225.00"
 */
function formatDollars(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)}`;
}

module.exports = { loadPricingConfig, calculateJob, formatDollars, LABELS };
