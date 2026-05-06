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

// ─────────────────────────────────────────────────────────────────────────────
// PRINT / PDF VIEW  GET /api/invoices/:id/print
// ─────────────────────────────────────────────────────────────────────────────
function formatDollars(n) {
  return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

router.get('/:id/print', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).send('<h2 style="font-family:sans-serif;padding:40px">Invoice not found.</h2>');
    const inv = result.rows[0];

    const lineItems = Array.isArray(inv.line_items) ? inv.line_items
      : (typeof inv.line_items === 'string' ? JSON.parse(inv.line_items || '[]') : []);

    const issued = new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const invNum = inv.invoice_number || `INV-${inv.id}`;

    const rows = lineItems.length > 0
      ? lineItems.map(item => `
          <tr>
            <td>${item.description || 'Stump grinding service'}</td>
            <td class="right">${item.quantity > 1 ? `${item.quantity} × ${formatDollars(item.unit_price)}` : ''}</td>
            <td class="right">${formatDollars((parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 1))}</td>
          </tr>`).join('')
      : `<tr><td colspan="3">Stump grinding service — ${inv.customer_name}</td></tr>`;

    const statusColor = inv.status === 'paid' ? 'status-approved' : inv.status === 'sent' ? 'status-sent' : 'status-draft';
    const statusLabel = inv.status === 'paid' ? 'PAID' : inv.status === 'sent' ? 'Sent' : 'Draft';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${invNum} — ${inv.customer_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1a1a1a; font-size: 14px; }
    .page { max-width: 760px; margin: 0 auto; padding: 40px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1a1a1a; padding-bottom: 24px; }
    .brand-name { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #1a1a1a; }
    .brand-tagline { font-size: 12px; color: #666; margin-top: 4px; }
    .brand-contact { text-align: right; font-size: 13px; color: #444; line-height: 1.7; }
    .doc-title { font-size: 32px; font-weight: 900; color: #1a1a1a; letter-spacing: -1px; margin-bottom: 6px; }
    .doc-meta { font-size: 13px; color: #888; margin-bottom: 28px; }
    .two-col { display: flex; gap: 40px; margin-bottom: 32px; }
    .col { flex: 1; }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 600; color: #1a1a1a; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { background: #f5f5f5; }
    th { padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; }
    th.right, td.right { text-align: right; }
    td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .subtotal-row td { color: #666; font-size: 13px; border-bottom: none; }
    .total-row td { font-size: 18px; font-weight: 900; color: #1a1a1a; border-bottom: none; border-top: 2px solid #1a1a1a; padding-top: 14px; }
    .section-box { border: 1px solid #e8e8e8; border-radius: 10px; overflow: hidden; margin-bottom: 24px; }
    .notes-box { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; }
    .notes-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 8px; }
    .notes-text { font-size: 13px; color: #444; line-height: 1.7; }
    .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #999; display: flex; justify-content: space-between; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 12px; vertical-align: middle; }
    .status-approved { background: #d4edda; color: #1a7a3c; }
    .status-sent { background: #d1e7ff; color: #0a58ca; }
    .status-draft { background: #f5f5f5; color: #666; }
    .paid-stamp { position: fixed; top: 80px; right: 40px; transform: rotate(-15deg); font-size: 48px; font-weight: 900; color: rgba(26,122,60,0.15); border: 6px solid rgba(26,122,60,0.15); padding: 8px 20px; border-radius: 8px; pointer-events: none; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    .print-btn {
      position: fixed; top: 16px; right: 16px; background: #1a1a1a; color: #fff;
      border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;
      font-weight: 700; cursor: pointer; font-family: inherit; z-index: 100;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Save as PDF ↓</button>
  ${inv.status === 'paid' ? '<div class="paid-stamp no-print">PAID</div>' : ''}
  <div class="page">
    <div class="header">
      <div>
        <div class="brand-name">Stump Pros WV</div>
        <div class="brand-tagline">Professional Stump Grinding & Removal</div>
      </div>
      <div class="brand-contact">
        📞 304-712-2005<br/>
        Charleston, WV &amp; surrounding areas<br/>
        stumpproswv.com
      </div>
    </div>

    <div>
      <div class="doc-title">
        Invoice
        <span class="status-badge ${statusColor}">${statusLabel}</span>
      </div>
      <div class="doc-meta">${invNum} &nbsp;·&nbsp; ${issued}</div>
    </div>

    <div class="two-col">
      <div class="col">
        <div class="label">Bill To</div>
        <div class="value">${inv.customer_name}</div>
        ${inv.customer_phone ? `<div style="font-size:13px;color:#666;margin-top:3px;">${inv.customer_phone}</div>` : ''}
        ${inv.customer_email ? `<div style="font-size:13px;color:#666;">${inv.customer_email}</div>` : ''}
      </div>
      ${inv.address ? `<div class="col"><div class="label">Service Address</div><div class="value" style="line-height:1.6;">${inv.address.replace(/,/g, ',<br/>')}</div></div>` : ''}
    </div>

    <div class="section-box">
      <table>
        <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead>
        <tbody>
          ${rows}
          ${parseFloat(inv.tax_pct) > 0 ? `
          <tr class="subtotal-row"><td colspan="2">Subtotal</td><td class="right">${formatDollars(inv.subtotal)}</td></tr>
          <tr class="subtotal-row"><td colspan="2">Tax (${inv.tax_pct}%)</td><td class="right">${formatDollars(inv.tax_amount)}</td></tr>` : ''}
          <tr class="total-row"><td colspan="2">Total Due</td><td class="right">${formatDollars(inv.total || inv.total_amount)}</td></tr>
        </tbody>
      </table>
    </div>

    ${inv.notes ? `<div class="notes-box"><div class="notes-label">Notes</div><div class="notes-text">${inv.notes}</div></div>` : ''}

    <div class="notes-box" style="background:#fff8e6;border-color:#f0d070;">
      <div class="notes-label">Payment</div>
      <div class="notes-text">
        Please make payment by check, cash, or Venmo/Zelle.<br/>
        Questions? Call or text 304-712-2005.
      </div>
    </div>

    <div class="footer">
      <span>Stump Pros WV &nbsp;·&nbsp; 304-712-2005 &nbsp;·&nbsp; Charleston, WV</span>
      <span>Thank you for your business!</span>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Print invoice error:', err);
    res.status(500).send('<h2 style="font-family:sans-serif;padding:40px">Error generating invoice. Please try again.</h2>');
  }
});

module.exports = router;
