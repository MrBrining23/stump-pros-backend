const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const pool = require('../db/pool');

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    environment: process.env.QB_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.QB_REDIRECT_URI,
  });
}

// Load tokens from DB, refresh if within 5 minutes of expiry
async function getValidToken() {
  const { rows } = await pool.query(
    'SELECT qb_access_token, qb_refresh_token, qb_realm_id, qb_token_expires_at FROM settings WHERE id = 1'
  );
  const s = rows[0];
  if (!s?.qb_access_token) {
    throw new Error('QuickBooks not connected — visit /api/quickbooks/auth to connect');
  }

  let accessToken = s.qb_access_token;
  let refreshToken = s.qb_refresh_token;

  const oauthClient = getOAuthClient();
  oauthClient.setToken({
    token_type: 'bearer',
    access_token: accessToken,
    refresh_token: refreshToken,
    realmId: s.qb_realm_id,
  });

  if (s.qb_token_expires_at && new Date(s.qb_token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await oauthClient.refresh();
    const t = refreshed.getJson();
    accessToken = t.access_token;
    refreshToken = t.refresh_token;
    await pool.query(
      `UPDATE settings
       SET qb_access_token = $1, qb_refresh_token = $2,
           qb_token_expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = 1`,
      [accessToken, refreshToken]
    );
  }

  const isSandbox = (process.env.QB_ENVIRONMENT || 'sandbox') === 'sandbox';
  const qbo = new QuickBooks(
    process.env.QB_CLIENT_ID,
    process.env.QB_CLIENT_SECRET,
    accessToken,
    false,           // no OAuth1 token secret
    s.qb_realm_id,
    isSandbox,       // use sandbox?
    false,           // debug
    null,            // minor version
    '2.0',           // OAuth version
    refreshToken
  );

  return { qbo, realmId: s.qb_realm_id, accessToken };
}

// Find or create a QB customer by display name
function findOrCreateCustomer(qbo, job) {
  return new Promise((resolve, reject) => {
    qbo.findCustomers(
      [{ field: 'DisplayName', value: job.customer_name, operator: '=' }],
      (err, data) => {
        if (err) return reject(err);
        const existing = data?.QueryResponse?.Customer;
        if (existing && existing.length > 0) return resolve(existing[0].Id);

        const newCustomer = { DisplayName: job.customer_name };
        if (job.phone) newCustomer.PrimaryPhone = { FreeFormNumber: job.phone };
        if (job.email) newCustomer.PrimaryEmailAddr = { Address: job.email };
        if (job.address) newCustomer.BillAddr = { Line1: job.address };

        qbo.createCustomer(newCustomer, (createErr, customer) => {
          if (createErr) return reject(createErr);
          resolve(customer.Id);
        });
      }
    );
  });
}

// Create a QB invoice for a job row
function createQBInvoice(qbo, job, customerId) {
  return new Promise((resolve, reject) => {
    const description = [
      job.package ? `Package: ${job.package}` : null,
      job.stump_count ? `Stumps: ${job.stump_count}` : null,
      job.notes || null,
    ].filter(Boolean).join(' | ') || 'Stump removal services';

    const amount = parseFloat(job.amount) || 0;
    const invoice = {
      CustomerRef: { value: customerId },
      Line: [
        {
          Amount: amount,
          DetailType: 'SalesItemLineDetail',
          Description: description,
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: 'Services' },
            UnitPrice: amount,
            Qty: 1,
          },
        },
      ],
    };

    qbo.createInvoice(invoice, (err, created) => {
      if (err) return reject(err);
      resolve(created);
    });
  });
}

// Main entry point: create a QB invoice for a job_id
async function createInvoiceForJob(jobId) {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
  if (!rows.length) throw new Error(`Job ${jobId} not found`);
  const job = rows[0];

  const { qbo, realmId } = await getValidToken();
  const customerId = await findOrCreateCustomer(qbo, job);
  const invoice = await createQBInvoice(qbo, job, customerId);

  const isSandbox = (process.env.QB_ENVIRONMENT || 'sandbox') === 'sandbox';
  const baseUrl = isSandbox
    ? 'https://app.sandbox.qbo.intuit.com/app/invoice'
    : 'https://app.qbo.intuit.com/app/invoice';
  const deepLink = `${baseUrl}?txnId=${invoice.Id}`;

  return {
    invoice_id: invoice.Id,
    invoice_number: invoice.DocNumber,
    amount: invoice.TotalAmt,
    customer_id: customerId,
    deep_link: deepLink,
  };
}

// Create a QB invoice from arbitrary invoice data (not tied to a job row)
async function createInvoiceFromData({ customer_name, email, phone, address, line_items = [], tax_pct = 0, notes }) {
  const { qbo } = await getValidToken();

  const customerData = { customer_name, email, phone, address };
  const customerId = await findOrCreateCustomer(qbo, customerData);

  const lines = line_items.map(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    return {
      Amount: Math.round(qty * price * 100) / 100,
      DetailType: 'SalesItemLineDetail',
      Description: item.description || 'Services',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        UnitPrice: price,
        Qty: qty,
      },
    };
  });

  if (notes) {
    lines.push({ DetailType: 'DescriptionOnly', Description: notes, Amount: 0 });
  }

  const invoice = { CustomerRef: { value: customerId }, Line: lines };

  return new Promise((resolve, reject) => {
    qbo.createInvoice(invoice, (err, created) => {
      if (err) return reject(err);
      const isSandbox = (process.env.QB_ENVIRONMENT || 'sandbox') === 'sandbox';
      const baseUrl = isSandbox
        ? 'https://app.sandbox.qbo.intuit.com/app/invoice'
        : 'https://app.qbo.intuit.com/app/invoice';
      resolve({
        invoice_id: created.Id,
        invoice_number: created.DocNumber,
        amount: created.TotalAmt,
        customer_id: customerId,
        deep_link: `${baseUrl}?txnId=${created.Id}`,
      });
    });
  });
}

module.exports = { getOAuthClient, getValidToken, createInvoiceForJob, createInvoiceFromData };
