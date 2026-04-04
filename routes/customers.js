const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET /api/customers?search=...&limit=50
router.get('/', async (req, res) => {
  try {
    const { search, limit = 200 } = req.query;
    let query, params;
    if (search) {
      query = `
        SELECT * FROM customers
        WHERE lower(name) LIKE $1 OR phone LIKE $2 OR lower(email) LIKE $3
        ORDER BY name ASC LIMIT $4`;
      const term = `%${search.toLowerCase()}%`;
      params = [term, `%${search}%`, term, parseInt(limit)];
    } else {
      query = `SELECT * FROM customers ORDER BY name ASC LIMIT $1`;
      params = [parseInt(limit)];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/customers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  const { name, phone, email, address, notes, source, external_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO customers (name, phone, email, address, notes, source, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phone || null, email || null, address || null, notes || null, source || 'manual', external_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/customers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/customers/:id
router.patch('/:id', async (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        notes = COALESCE($5, notes)
       WHERE id = $6 RETURNING *`,
      [name, phone, email, address, notes, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/import/quickbooks — pull customers from QB
router.post('/import/quickbooks', async (req, res) => {
  try {
    const settingsResult = await pool.query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsResult.rows[0] || {};
    const { qb_access_token, qb_realm_id } = settings;
    if (!qb_access_token || !qb_realm_id) {
      return res.status(400).json({ error: 'QuickBooks not connected. Connect QB in Settings first.' });
    }

    const queryStr = encodeURIComponent("SELECT Id, DisplayName, PrimaryPhone, PrimaryEmailAddr, BillAddr FROM Customer MAXRESULTS 1000 STARTPOSITION 1");
    const qbRes = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${qb_realm_id}/query?query=${queryStr}&minorversion=65`,
      { headers: { Authorization: `Bearer ${qb_access_token}`, Accept: 'application/json' } }
    );

    if (!qbRes.ok) {
      const errText = await qbRes.text();
      return res.status(502).json({ error: 'QuickBooks API error', detail: errText });
    }

    const qbData = await qbRes.json();
    const qbCustomers = (qbData.QueryResponse?.Customer) || [];

    let imported = 0, skipped = 0;
    for (const c of qbCustomers) {
      const name = c.DisplayName || c.FullyQualifiedName;
      if (!name) continue;
      const phone = c.PrimaryPhone?.FreeFormNumber || null;
      const email = c.PrimaryEmailAddr?.Address || null;
      const addr = c.BillAddr
        ? [c.BillAddr.Line1, c.BillAddr.City, c.BillAddr.CountrySubDivisionCode].filter(Boolean).join(', ')
        : null;
      const extId = String(c.Id);

      // Upsert by external_id (QB ID)
      const exists = await pool.query(
        'SELECT id FROM customers WHERE external_id = $1 AND source = $2',
        [extId, 'quickbooks']
      );
      if (exists.rows.length) {
        await pool.query(
          `UPDATE customers SET name=$1, phone=COALESCE($2,phone), email=COALESCE($3,email), address=COALESCE($4,address)
           WHERE id=$5`,
          [name, phone, email, addr, exists.rows[0].id]
        );
        skipped++;
      } else {
        await pool.query(
          `INSERT INTO customers (name, phone, email, address, source, external_id)
           VALUES ($1, $2, $3, $4, 'quickbooks', $5)`,
          [name, phone, email, addr, extId]
        );
        imported++;
      }
    }

    res.json({ success: true, imported, updated: skipped, total: qbCustomers.length });
  } catch (err) {
    console.error('QB import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/import/csv — import from Housecall Pro (or any CSV)
// Expected CSV columns (flexible): Name/Customer Name, Phone, Email, Address
router.post('/import/csv', async (req, res) => {
  try {
    const { rows } = req.body; // array of objects from parsed CSV
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided. Send { rows: [...] } with parsed CSV data.' });
    }

    let imported = 0, skipped = 0;
    for (const row of rows) {
      // Flexible column matching (HCP uses different header names)
      const name = row['Customer Name'] || row['Name'] || row['Full Name'] || row['name'] || '';
      if (!name.trim()) continue;

      const phone = row['Phone'] || row['Mobile'] || row['Cell Phone'] || row['phone'] || null;
      const email = row['Email'] || row['Email Address'] || row['email'] || null;
      const address = row['Address'] || row['Service Address'] || row['Billing Address'] || row['address'] || null;
      const extId = row['ID'] || row['Customer ID'] || row['id'] || null;

      // Skip duplicates by name+phone
      const exists = await pool.query(
        'SELECT id FROM customers WHERE lower(name) = lower($1) AND (phone = $2 OR ($2 IS NULL AND phone IS NULL))',
        [name.trim(), phone ? phone.replace(/\D/g, '') : null]
      );
      if (exists.rows.length) { skipped++; continue; }

      await pool.query(
        `INSERT INTO customers (name, phone, email, address, source, external_id)
         VALUES ($1, $2, $3, $4, 'housecall_pro', $5)`,
        [name.trim(), phone || null, email || null, address || null, extId || null]
      );
      imported++;
    }

    res.json({ success: true, imported, skipped, total: rows.length });
  } catch (err) {
    console.error('CSV import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
