/**
 * routes/estimates.js — Stump Pros WV
 *
 * Endpoints:
 *   POST   /api/estimates                      Create estimate
 *   GET    /api/estimates                      List estimates
 *   GET    /api/estimates/:id                  Get estimate + stump items + photos
 *   PATCH  /api/estimates/:id                  Update status/notes
 *   DELETE /api/estimates/:id                  Delete estimate
 *   POST   /api/estimates/calculate            Price preview (no DB write)
 *   POST   /api/estimates/:id/photos           Upload photo(s)
 *   DELETE /api/estimates/:id/photos/:photoId  Delete a photo
 *   POST   /api/estimates/:id/send             Send approval SMS to customer
 *   POST   /api/estimates/:id/accept-onsite    Accept in-app (converts immediately)
 *   GET    /approve/:token                     Customer approval page (public HTML)
 *   POST   /approve/:token/approve             Customer approves
 *   POST   /approve/:token/reject              Customer rejects
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const pool    = require('../db/pool');

const { sendSMS }                              = require('../services/smsService');
const { loadPricingConfig, calculateJob,
        formatDollars, LABELS }                = require('../services/pricingEngine');
const { uploadPhoto, deletePhoto, thumbnailUrl } = require('../services/photoService');

const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const APP_URL = process.env.APP_URL || 'https://stump-pros-backend-production.up.railway.app';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function nextInvoiceNumber(client) {
  const { rows } = await client.query(`SELECT nextval('invoice_number_seq') AS n`);
  return `INV-${new Date().getFullYear()}-${String(rows[0].n).padStart(4, '0')}`;
}

async function getEstimateWithItems(id) {
  const { rows } = await pool.query(`SELECT * FROM estimates WHERE id = $1`, [id]);
  if (!rows.length) return null;
  const est = rows[0];

  const { rows: stumps } = await pool.query(
    `SELECT * FROM estimate_stump_items WHERE estimate_id = $1 ORDER BY stump_number`, [id]
  );
  const { rows: photos } = await pool.query(
    `SELECT * FROM estimate_photos WHERE estimate_id = $1 ORDER BY display_order, created_at`, [id]
  );

  return { ...est, stump_items: stumps, photos };
}

async function processApproval(estimateId, approvedBy, signatureData = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: estRows } = await client.query(
      `SELECT e.*, json_agg(s ORDER BY s.stump_number) AS stump_items
       FROM estimates e
       LEFT JOIN estimate_stump_items s ON s.estimate_id = e.id
       WHERE e.id = $1 FOR UPDATE`,
      [estimateId]
    );
    if (!estRows.length) throw new Error('Estimate not found');
    const est = estRows[0];
    if (est.status === 'converted') throw new Error('Already converted');
    if (est.status === 'rejected')  throw new Error('Estimate was rejected');

    // Create job
    const { rows: jobRows } = await client.query(
      `INSERT INTO jobs (lead_id, estimate_id, customer_name, customer_phone,
         customer_email, address, total_amount, stump_count, notes,
         status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_schedule',NOW(),NOW())
       RETURNING *`,
      [est.lead_id, est.id, est.customer_name, est.customer_phone,
       est.customer_email, est.address, est.total_amount,
       est.stump_count, est.notes]
    );
    const job = jobRows[0];

    // Create invoice
    const invoiceNumber = await nextInvoiceNumber(client);
    const { rows: invRows } = await client.query(
      `INSERT INTO invoices (job_id, estimate_id, lead_id, customer_name, customer_phone,
         customer_email, address, invoice_number, status,
         subtotal, tax_amount, total_amount, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,0,$10,NOW(),NOW())
       RETURNING *`,
      [job.id, est.id, est.lead_id, est.customer_name, est.customer_phone,
       est.customer_email, est.address, invoiceNumber,
       est.total_amount, est.total_amount]
    );
    const invoice = invRows[0];

    // Invoice line items (one per stump)
    for (const stump of est.stump_items) {
      const mods = [
        stump.difficulty !== 'normal' ? LABELS.difficulty[stump.difficulty] : null,
        stump.access !== 'open'       ? LABELS.access[stump.access]         : null,
        stump.depth !== 'standard'    ? LABELS.depth[stump.depth]           : null,
        stump.cleanup !== 'none'      ? LABELS.cleanup[stump.cleanup]       : null,
      ].filter(Boolean);

      const desc = `Stump Grinding — ${stump.diameter_inches}" diameter` +
        (mods.length ? ` (${mods.join(', ')})` : '');

      await client.query(
        `INSERT INTO invoice_line_items
           (invoice_id, stump_number, description, diameter_inches,
            difficulty, access, depth, cleanup, unit_price, quantity, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$9)`,
        [invoice.id, stump.stump_number, desc, stump.diameter_inches,
         stump.difficulty, stump.access, stump.depth, stump.cleanup, stump.subtotal]
      );
    }

    await client.query(`UPDATE jobs SET invoice_id = $1 WHERE id = $2`, [invoice.id, job.id]);

    await client.query(
      `UPDATE estimates SET status='converted', approved_at=NOW(),
         approved_by=$1, signature_data=$2, updated_at=NOW() WHERE id=$3`,
      [approvedBy, signatureData, est.id]
    );

    if (est.lead_id) {
      await client.query(
        `UPDATE leads SET status='converted', updated_at=NOW() WHERE id=$1`, [est.lead_id]
      );
    }

    await client.query('COMMIT');
    return { job, invoice, invoiceNumber };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE CALCULATOR  — no DB write
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calculate', async (req, res) => {
  try {
    const config = await loadPricingConfig();
    res.json(calculateJob(req.body.stumps || [], config));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ESTIMATE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { lead_id, customer_name, customer_phone, customer_email,
            address, stumps, notes, valid_days = 30 } = req.body;

    if (!customer_name || !customer_phone)
      return res.status(400).json({ error: 'customer_name and customer_phone required' });
    if (!Array.isArray(stumps) || !stumps.length)
      return res.status(400).json({ error: 'At least one stump required' });

    const config = await loadPricingConfig();
    const priced = calculateJob(stumps, config);

    await client.query('BEGIN');

    const { rows: estRows } = await client.query(
      `INSERT INTO estimates (lead_id, customer_name, customer_phone, customer_email,
         address, total_amount, stump_count, notes, status, valid_until, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft', NOW() + INTERVAL '1 day' * $9, NOW(), NOW())
       RETURNING *`,
      [lead_id||null, customer_name, customer_phone, customer_email||null,
       address||null, priced.job_total, priced.stumps.length, notes||null, valid_days]
    );
    const estimate = estRows[0];

    for (const s of priced.stumps) {
      await client.query(
        `INSERT INTO estimate_stump_items (estimate_id, stump_number, diameter_inches,
           difficulty, access, depth, cleanup, notes, base_price, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [estimate.id, s.stump_number, s.diameter_inches,
         s.difficulty||'normal', s.access||'open', s.depth||'standard',
         s.cleanup||'none', s.notes||null, s.base_price, s.subtotal]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...estimate,
      stump_items: priced.stumps,
      photos: [],
      pricing_summary: {
        stump_subtotal:      priced.stump_subtotal,
        job_total:           priced.job_total,
        job_minimum_applied: priced.job_minimum_applied,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create estimate error:', err);
    res.status(500).json({ error: 'Failed to create estimate' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, lead_id } = req.query;
    const conditions = []; const params = [];
    if (status)  { params.push(status);  conditions.push(`e.status = $${params.length}`); }
    if (lead_id) { params.push(lead_id); conditions.push(`e.lead_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT e.*,
         (SELECT COUNT(*) FROM estimate_photos WHERE estimate_id = e.id) AS photo_count
       FROM estimates e ${where} ORDER BY e.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch estimates' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const est = await getEstimateWithItems(req.params.id);
    if (!est) return res.status(404).json({ error: 'Not found' });
    res.json(est);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch estimate' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes, address } = req.body;
    const fields = []; const values = [];
    if (status  !== undefined) { values.push(status);  fields.push(`status = $${values.length}`); }
    if (notes   !== undefined) { values.push(notes);   fields.push(`notes = $${values.length}`); }
    if (address !== undefined) { values.push(address); fields.push(`address = $${values.length}`); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE estimates SET ${fields.join(', ')}, updated_at=NOW()
       WHERE id=$${values.length} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Also delete photos from Cloudinary
    const { rows: photos } = await pool.query(
      `SELECT cloudinary_public_id FROM estimate_photos WHERE estimate_id = $1`, [req.params.id]
    );
    for (const p of photos) {
      await deletePhoto(p.cloudinary_public_id).catch(() => {});
    }
    const { rowCount } = await pool.query(`DELETE FROM estimates WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD PHOTOS  POST /api/estimates/:id/photos
// Accepts: multipart/form-data, field name "photos" (up to 10 files)
// Also accepts: caption (text), display_order (number)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const { rows: estCheck } = await pool.query(
      `SELECT id FROM estimates WHERE id = $1`, [req.params.id]
    );
    if (!estCheck.length) return res.status(404).json({ error: 'Estimate not found' });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });

    const captions = Array.isArray(req.body.caption)
      ? req.body.caption
      : [req.body.caption || ''];

    const saved = [];
    for (let i = 0; i < req.files.length; i++) {
      const file    = req.files[i];
      const caption = captions[i] || captions[0] || null;

      const { url, public_id } = await uploadPhoto(
        file.buffer,
        req.params.id,
        file.originalname
      );

      const { rows } = await pool.query(
        `INSERT INTO estimate_photos
           (estimate_id, cloudinary_url, cloudinary_public_id, caption, display_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.id, url, public_id, caption, i]
      );
      saved.push(rows[0]);
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PHOTO  DELETE /api/estimates/:id/photos/:photoId
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM estimate_photos WHERE id=$1 AND estimate_id=$2
       RETURNING cloudinary_public_id`,
      [req.params.photoId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    await deletePhoto(rows[0].cloudinary_public_id).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEND ESTIMATE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/send', async (req, res) => {
  try {
    const est = await getEstimateWithItems(req.params.id);
    if (!est) return res.status(404).json({ error: 'Not found' });

    const approvalUrl = `${APP_URL}/e/${est.approval_token}`;
    const firstName   = est.customer_name.split(' ')[0];

    const stumpLines = est.stump_items
      .map((s, i) => `  • Stump ${i + 1}: ${s.diameter_inches}" — ${formatDollars(s.subtotal)}`)
      .join('\n');

    const sms =
      `Hi ${firstName}, here's your Stump Pros WV estimate:\n\n` +
      `${stumpLines}\n\n` +
      `Total: ${formatDollars(est.total_amount)}\n\n` +
      `Tap to review & approve:\n${approvalUrl}\n\n` +
      `Questions? Call/text 304-712-2005`;

    await sendSMS(est.customer_phone, sms);

    await pool.query(
      `UPDATE estimates SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [est.id]
    );

    res.json({ success: true, approval_url: approvalUrl });
  } catch (err) {
    console.error('Send estimate error:', err);
    res.status(500).json({ error: 'Failed to send estimate' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPT ON-SITE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/accept-onsite', async (req, res) => {
  try {
    const result = await processApproval(
      parseInt(req.params.id), 'onsite', req.body.signature_data || null
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC APPROVAL PAGE  GET /approve/:token
// ─────────────────────────────────────────────────────────────────────────────
router.get('/e/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, json_agg(s ORDER BY s.stump_number) AS stump_items
       FROM estimates e
       LEFT JOIN estimate_stump_items s ON s.estimate_id = e.id
       WHERE e.approval_token = $1 GROUP BY e.id`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).send('<h2 style="font-family:sans-serif;padding:40px">Estimate not found. Please call <a href="tel:3047122005">304-712-2005</a>.</h2>');

    const { rows: photos } = await pool.query(
      `SELECT * FROM estimate_photos WHERE estimate_id = $1 ORDER BY display_order, created_at`,
      [rows[0].id]
    );

    res.send(buildApprovalPage(rows[0], photos, req.params.token));
  } catch (err) {
    res.status(500).send('<h2 style="font-family:sans-serif;padding:40px">Something went wrong. Please call <a href="tel:3047122005">304-712-2005</a>.</h2>');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER APPROVE  POST /approve/:token/approve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/e/:token/approve', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, customer_name, status FROM estimates WHERE approval_token = $1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status === 'converted') return res.json({ success: true, already_approved: true });

    const result = await processApproval(rows[0].id, 'customer', null);

    // Notify Joshua
    const ownerPhone = process.env.STUMP_PROS_OWNER_PHONE;
    if (ownerPhone) {
      sendSMS(ownerPhone,
        `✅ Estimate approved by ${rows[0].customer_name}!\n` +
        `Invoice ${result.invoiceNumber} created — job added to schedule queue.`
      ).catch(() => {});
    }

    res.json({ success: true, job_id: result.job.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER REJECT  POST /approve/:token/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post('/e/:token/reject', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE estimates SET status='rejected', rejected_at=NOW(),
         rejection_reason=$1, updated_at=NOW()
       WHERE approval_token=$2 AND status NOT IN ('converted','rejected')
       RETURNING customer_name`,
      [req.body.reason || null, req.params.token]
    );
    const ownerPhone = process.env.STUMP_PROS_OWNER_PHONE;
    if (ownerPhone && rows.length) {
      sendSMS(ownerPhone,
        `❌ Estimate declined by ${rows[0].customer_name}.` +
        (req.body.reason ? `\nReason: ${req.body.reason}` : '')
      ).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process rejection' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BUILD APPROVAL PAGE HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildApprovalPage(est, photos, token) {
  const isApproved = est.status === 'converted';
  const isRejected = est.status === 'rejected';
  const isExpired  = est.valid_until && new Date(est.valid_until) < new Date();

  const stumpRows = (est.stump_items || []).map((s, i) => {
    const mods = [
      s.difficulty !== 'normal' ? LABELS.difficulty[s.difficulty] : null,
      s.access !== 'open'       ? LABELS.access[s.access]         : null,
      s.depth !== 'standard'    ? LABELS.depth[s.depth]           : null,
      s.cleanup !== 'none'      ? LABELS.cleanup[s.cleanup]       : null,
    ].filter(Boolean);
    return `
      <div class="stump-row">
        <div class="stump-info">
          <span class="num">#${i + 1}</span>
          <div>
            <div>${s.diameter_inches}" diameter stump</div>
            ${mods.length ? `<div class="mods">${mods.join(' · ')}</div>` : ''}
          </div>
        </div>
        <span class="price">${formatDollars(s.subtotal)}</span>
      </div>`;
  }).join('');

  // Photo grid — shown above the breakdown
  const photoGrid = photos.length ? `
    <div class="section">
      <div class="section-title">Job Photos</div>
      <div class="photo-grid">
        ${photos.map(p => `
          <div class="photo-item">
            <img src="${thumbnailUrl(p.cloudinary_url, 600)}" alt="${p.caption || 'Job photo'}" loading="lazy" onclick="openPhoto('${p.cloudinary_url}')"/>
            ${p.caption ? `<div class="photo-caption">${p.caption}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>` : '';

  const statusBanner = isApproved
    ? `<div class="banner green">✅ Approved — we'll be in touch to schedule your appointment.</div>`
    : isRejected
    ? `<div class="banner red">This estimate was declined. Call us anytime: <a href="tel:3047122005">304-712-2005</a></div>`
    : isExpired
    ? `<div class="banner yellow">This estimate has expired. Call for an updated quote: <a href="tel:3047122005">304-712-2005</a></div>`
    : '';

  const actions = (!isApproved && !isRejected && !isExpired) ? `
    <button class="btn green" id="approveBtn" onclick="doApprove()">✓ Approve Estimate</button>
    <button class="btn ghost" id="rejectBtn" onclick="showReject()">Decline</button>
    <div id="rejectForm" style="display:none;margin-top:12px">
      <textarea id="rejectReason" placeholder="Optional: let us know why" rows="3"></textarea>
      <button class="btn red" onclick="doReject()">Confirm Decline</button>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Estimate — Stump Pros WV</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f2ee;color:#1a1a1a;min-height:100vh}
    .header{background:#1a1a1a;padding:18px 20px}
    .header-tag{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c4a43e;font-weight:700;margin-bottom:4px}
    .header h1{font-size:22px;font-weight:800;color:#fff}
    .header .sub{font-size:13px;color:#777;margin-top:3px}
    .total-bar{background:#c4a43e;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
    .total-bar .lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#000}
    .total-bar .amt{font-size:30px;font-weight:900;color:#000}
    .body{padding:16px;max-width:480px;margin:0 auto}
    .banner{border-radius:10px;padding:13px 16px;font-size:14px;font-weight:600;margin-bottom:16px;line-height:1.4}
    .banner.green{background:#d4edda;color:#1a5c2a;border:1px solid #a8d5b5}
    .banner.red{background:#fdecea;color:#6b1a1a;border:1px solid #e8b3b0}
    .banner.yellow{background:#fff3cd;color:#664d03;border:1px solid #ffc107}
    .banner a{color:inherit}
    .section{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:12px}
    /* Photo grid */
    .photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .photo-item img{width:100%;border-radius:8px;display:block;cursor:pointer;aspect-ratio:4/3;object-fit:cover}
    .photo-caption{font-size:11px;color:#888;text-align:center;margin-top:4px}
    /* Photo lightbox */
    #lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100;align-items:center;justify-content:center}
    #lightbox.open{display:flex}
    #lightbox img{max-width:95vw;max-height:90vh;border-radius:8px;object-fit:contain}
    #lightbox .close{position:absolute;top:16px;right:20px;color:#fff;font-size:28px;cursor:pointer;background:none;border:none}
    /* Stump rows */
    .stump-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f0f0f0}
    .stump-row:last-child{border-bottom:none}
    .stump-info{display:flex;align-items:flex-start;gap:10px;flex:1;font-size:14px;line-height:1.5}
    .num{background:#c4a43e;color:#000;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;margin-top:1px}
    .mods{font-size:12px;color:#888;margin-top:2px}
    .price{font-size:16px;font-weight:700;flex-shrink:0;margin-left:12px;padding-top:1px}
    .total-row{display:flex;justify-content:space-between;padding-top:12px;margin-top:4px;font-size:20px;font-weight:900;color:#c4a43e;border-top:2px solid #f0f0f0}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .info-item .lbl{font-size:11px;color:#aaa;text-transform:uppercase;font-weight:600;letter-spacing:.05em}
    .info-item .val{font-size:14px;font-weight:700;margin-top:2px}
    .btn{display:block;width:100%;padding:16px;border:none;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px;font-family:inherit}
    .btn.green{background:#2e7d32;color:#fff;font-size:18px}
    .btn.ghost{background:transparent;color:#888;border:1px solid #ddd;font-size:14px}
    .btn.red{background:#c62828;color:#fff}
    textarea{width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;margin-bottom:10px}
    #successMsg{display:none;text-align:center;padding:32px 20px}
    #successMsg h2{font-size:28px;color:#2e7d32;margin-bottom:10px}
    #successMsg p{color:#666;font-size:15px;line-height:1.5}
    .footer{text-align:center;padding:24px;font-size:13px;color:#aaa}
    .footer a{color:#c4a43e;text-decoration:none;font-weight:700}
  </style>
</head>
<body>

<div class="header">
  <div class="header-tag">Stump Pros WV</div>
  <h1>Your Estimate</h1>
  <div class="sub">${est.customer_name}${est.address ? ' · ' + est.address : ''}</div>
</div>

<div class="total-bar">
  <span class="lbl">Total</span>
  <span class="amt">${formatDollars(est.total_amount)}</span>
</div>

<div class="body">
  ${statusBanner}

  <div id="mainContent">
    ${photoGrid}

    <div class="section">
      <div class="section-title">Stump Breakdown</div>
      ${stumpRows}
      <div class="total-row"><span>Total</span><span>${formatDollars(est.total_amount)}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Details</div>
      <div class="info-grid">
        <div class="info-item"><div class="lbl">Stumps</div><div class="val">${est.stump_count || (est.stump_items || []).length}</div></div>
        <div class="info-item"><div class="lbl">Valid Until</div><div class="val">${est.valid_until ? new Date(est.valid_until).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '30 days'}</div></div>
      </div>
    </div>

    ${actions}
  </div>

  <div id="successMsg">
    <h2>✅ Approved!</h2>
    <p>Thanks, ${est.customer_name.split(' ')[0]}! We'll reach out soon to schedule your appointment.</p>
    <p style="margin-top:12px">Questions? <a href="tel:3047122005">304-712-2005</a></p>
  </div>
</div>

<div class="footer">
  <a href="tel:3047122005">304-712-2005</a> · <a href="https://stumpproswv.com">stumpproswv.com</a><br>
  Hedgesville, WV · Serving the Eastern Panhandle
</div>

<!-- Lightbox for full-size photos -->
<div id="lightbox">
  <button class="close" onclick="closeLightbox()">✕</button>
  <img id="lightboxImg" src="" alt="Job photo"/>
</div>

<script>
  const TOKEN = '${token}';
  const BASE  = '${APP_URL}';

  function openPhoto(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').classList.add('open');
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
  }
  document.getElementById('lightbox').addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
  });

  async function doApprove() {
    const btn = document.getElementById('approveBtn');
    btn.textContent = 'Processing…'; btn.disabled = true;
    try {
      const res  = await fetch(BASE + '/e/' + TOKEN + '/approve', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('successMsg').style.display  = 'block';
      } else {
        alert(data.error || 'Something went wrong. Please call 304-712-2005.');
        btn.textContent = '✓ Approve Estimate'; btn.disabled = false;
      }
    } catch {
      alert('Network error. Please call 304-712-2005.');
      btn.textContent = '✓ Approve Estimate'; btn.disabled = false;
    }
  }

  function showReject() {
    document.getElementById('rejectForm').style.display = 'block';
    document.getElementById('rejectBtn').style.display  = 'none';
  }

  async function doReject() {
    const reason = document.getElementById('rejectReason').value;
    try {
      await fetch(BASE + '/e/' + TOKEN + '/reject', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ reason })
      });
      document.getElementById('mainContent').innerHTML =
        '<div class="banner red">Estimate declined. Feel free to call us anytime — <a href="tel:3047122005">304-712-2005</a></div>';
    } catch {
      alert('Network error. Please call 304-712-2005.');
    }
  }
</script>
</body>
</html>`;
}

module.exports = router;
