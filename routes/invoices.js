const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { createInvoiceFromData } = require('../services/quickbooks');

function calcTotals(lineItems, taxPct) {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 1);
  }, 0);
  const tax_amount = Math.round(subtotal * (parseFloat(taxPct) || 0) / 100 * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax_amount, total };
}

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/invoices error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices — create invoice, optionally sync to QB
router.post('/', async (req, res) => {
  const {
    job_id, estimate_id, customer_name, phone, email, address,
    line_items = [], tax_pct = 0, notes, sync_to_qb = false,
  } = req.body;

  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });

  const { subtotal, tax_amount, total } = calcTotals(line_items, tax_pct);

  try {
    const result = await pool.query(
      `INSERT INTO invoices
         (job_id, estimate_id, customer_name, phone, email, address,
          line_items, subtotal, tax_pct, tax_amount, total, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12)
       RETURNING *`,
      [job_id || null, estimate_id || null, customer_name, phone || null,
       email || null, address || null, JSON.stringify(line_items),
       subtotal, tax_pct, tax_amount, total, notes || null]
    );
    const invoice = result.rows[0];

    if (sync_to_qb) {
      try {
        const qbResult = await createInvoiceFromData({
          customer_name, email, phone, address, line_items, tax_pct, notes,
        });
        const updated = await pool.query(
          `UPDATE invoices
           SET qb_invoice_id = $1, qb_invoice_url = $2, status = 'sent'
           WHERE id = $3 RETURNING *`,
          [qbResult.invoice_id, qbResult.deep_link, invoice.id]
        );
        return res.json(updated.rows[0]);
      } catch (qbErr) {
        console.error('QB sync failed:', qbErr.message);
        // Return the saved invoice even if QB sync fails
        invoice.qb_error = qbErr.message;
        return res.json(invoice);
      }
    }

    res.json(invoice);
  } catch (err) {
    console.error('POST /api/invoices error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/invoices/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'sent', 'paid'].includes(status)) {
    return res.status(400).json({ error: 'status must be draft, sent, or paid' });
  }
  try {
    const result = await pool.query(
      'UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/invoices/:id/status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/invoices/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
