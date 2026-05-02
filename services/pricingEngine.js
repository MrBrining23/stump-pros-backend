/**
 * services/pricingEngine.js — Stump Pros WV
 *
 * Pricing model: ADDITIVE (not compounding).
 * Each option adds its percentage to the base price independently,
 * so surcharges don't multiply on top of each other.
 *
 * Multipliers stored as full factors (1 + delta) in pricing_config.
 * calculateJob converts each to delta = mult - 1, sums all deltas,
 * then applies: subtotal = base × (1 + total_delta)
 *
 * Config keys (all stored in pricing_config table):
 *   price_per_inch              — base $/inch ($5.00)
 *   large_stump_price_per_inch  — $/inch for stumps >40" ($6.00)
 *   min_charge_per_stump        — floor per stump ($50.00)
 *   min_charge_per_job          — floor per job ($225.00)
 *   difficulty_multipliers      — JSON { normal, hard, very_dense, decomposing }
 *   access_multipliers          — JSON { open, limited, very_limited }
 *   height_multipliers          — JSON { flush, mid, tall }
 *   cleanup_multipliers         — JSON { none, chips_only, full_cleanup }
 *   roots_multipliers           — JSON { none, surface, full_yard }
 */

const pool = require('../db/pool');

const DEFAULTS = {
  price_per_inch:               5.00,
  large_stump_price_per_inch:   6.00,
  min_charge_per_stump:         50.00,
  min_charge_per_job:           225.00,
  // Factors stored as (1 + delta); e.g. hard: 1.15 means +15% of base
  difficulty_multipliers: { normal: 1.0, hard: 1.15, very_dense: 1.25, decomposing: 0.85 },
  access_multipliers:     { open: 1.0, limited: 1.20, very_limited: 1.35 },
  height_multipliers:     { flush: 1.0, mid: 1.15, tall: 1.25 },
  cleanup_multipliers:    { none: 1.0, chips_only: 1.5, full_cleanup: 2.0 },
  roots_multipliers:      { none: 1.0, surface: 1.25, full_yard: 1.6 },
};

const LABELS = {
  difficulty: { normal: 'Normal', hard: 'Hard Wood', very_dense: 'Very Dense', decomposing: 'Decomposing' },
  access:     { open: 'Open Access', limited: 'Limited Access', very_limited: 'Very Limited Access' },
  height:     { flush: 'Flush to 6"', mid: '7–15"', tall: '16"+"' },
  cleanup:    { none: 'Chips Left', chips_only: 'Chips Removed', full_cleanup: 'Full Cleanup' },
  roots:      { none: 'None / Minimal', surface: 'Mound / Surface Roots', full_yard: 'Whole Area / Yard' },
  rocky:      'Rocky Soil',
};

/**
 * Load pricing configuration from the pricing_config table.
 * Falls back to DEFAULTS for any missing keys.
 */
async function loadPricingConfig() {
  try {
    const keys = [
      'price_per_inch', 'large_stump_price_per_inch', 'min_charge_per_stump', 'min_charge_per_job',
      'difficulty_multipliers', 'access_multipliers', 'height_multipliers', 'cleanup_multipliers',
      'roots_multipliers',
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
    return { ...DEFAULTS };
  }
}

/**
 * Calculate pricing for an array of stumps using ADDITIVE surcharges.
 * Each surcharge is calculated as a % of base_price, not compounded.
 *
 * subtotal = base_price × (1 + diff_delta + access_delta + height_delta + ...)
 */
function calculateJob(stumps, config) {
  const {
    price_per_inch:               pricePerInch,
    large_stump_price_per_inch:   largePricePerInch,
    min_charge_per_stump:         minPerStump,
    min_charge_per_job:           minPerJob,
    difficulty_multipliers: diffMult,
    access_multipliers:     accessMult,
    height_multipliers:     heightMult,
    cleanup_multipliers:    cleanupMult,
    roots_multipliers:      rootsMult,
  } = config;

  const priced = stumps.map((s, i) => {
    const diameter = parseFloat(s.diameter_inches) || 0;
    const diff     = s.difficulty || 'normal';
    const access   = s.access     || 'open';
    const height   = s.height     || 'flush';
    const cleanup  = s.cleanup    || 'none';
    const roots    = s.roots      || 'none';

    const ratePerInch = diameter > 40 ? largePricePerInch : pricePerInch;
    const base_price  = Math.max(diameter * ratePerInch, minPerStump);

    // Convert each factor to an additive delta, then sum (no compounding)
    const total_adds =
      ((diffMult[diff]       || 1.0) - 1.0) +
      ((accessMult[access]   || 1.0) - 1.0) +
      ((heightMult[height]   || 1.0) - 1.0) +
      ((cleanupMult[cleanup] || 1.0) - 1.0) +
      ((rootsMult[roots]     || 1.0) - 1.0) +
      (s.rocky      ? 0.20 : 0.0) +
      (s.extra_deep ? 0.20 : 0.0);  // extra deep = +20%

    const subtotal = Math.round(base_price * (1 + total_adds) * 100) / 100;

    return {
      ...s,
      stump_number:    i + 1,
      diameter_inches: diameter,
      difficulty:      diff,
      access:          access,
      height:          height,
      cleanup:         cleanup,
      roots:           roots,
      rocky:           s.rocky      || false,
      extra_deep:      s.extra_deep || false,
      base_price:      Math.round(base_price * 100) / 100,
      subtotal,
    };
  });

  // Volume discount based on stump count
  const count = priced.length;
  const volume_discount =
    count >= 21 ? 0.25 :
    count >= 11 ? 0.20 :
    count >= 5  ? 0.15 : 0;

  const discounted = priced.map(s => ({
    ...s,
    subtotal: volume_discount > 0
      ? Math.round(s.subtotal * (1 - volume_discount) * 100) / 100
      : s.subtotal,
  }));

  const stump_subtotal      = Math.round(discounted.reduce((sum, s) => sum + s.subtotal, 0) * 100) / 100;
  const job_minimum_applied = stump_subtotal < minPerJob;
  const raw_total           = job_minimum_applied ? minPerJob : stump_subtotal;
  const job_total           = Math.ceil(raw_total / 25) * 25;  // round up to nearest $25

  return { stumps: discounted, stump_subtotal, job_total, job_minimum_applied, volume_discount };
}

function formatDollars(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)}`;
}

module.exports = { loadPricingConfig, calculateJob, formatDollars, LABELS };
