const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('GET /api/settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  const { auto_text, review_delay, google_review_url, facebook_review_url } = req.body;

  try {
    const result = await pool.query(
      `UPDATE settings
       SET auto_text = COALESCE($1, auto_text),
           review_delay = COALESCE($2, review_delay),
           google_review_url = COALESCE($3, google_review_url),
           facebook_review_url = COALESCE($4, facebook_review_url)
       WHERE id = 1
       RETURNING *`,
      [auto_text, review_delay, google_review_url, facebook_review_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
