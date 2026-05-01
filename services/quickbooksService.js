const pool = require('../db/pool');

const QB_BASE  = 'https://quickbooks.api.intuit.com';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const AUTH_URL  = 'https://appcenter.intuit.com/connect/oauth2';

const CLIENT_ID     = process.env.QB_CLIENT_ID;
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET;
const REDIRECT_URI  = process.env.QB_REDIRECT_URI;

// ── Token storage (oauth_tokens table) ──────────────────────

async function getTokens() {
  const { rows } = await pool.query(
    `SELECT * FROM oauth_tokens WHERE provider = 'quickbooks'`
  );
  return rows[0] || null;
}

async function saveTokens({ access_token, refresh_token, realm_id, expires_in }) {
  const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000);
  await pool.query(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, realm_id, expires_at, updated_at)
     VALUES ('quickbooks', $1, $2, $3, $4, NOW())
     ON CONFLICT (provider) DO UPDATE SET
       access_token  = $1,
       refresh_token = $2,
       realm_id      = $3,
       expires_at    = $4,
       updated_at    = NOW()`,
    [access_token, refresh_token, realm_id, expires_at]
  );
}

// ── Token refresh ────────────────────────────────────────────

async function refreshAccessToken(refresh_token) {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Token refresh failed');
  return data;
}

async function getValidToken() {
  const tokens = await getTokens();
  if (!tokens) {
    throw new Error('QuickBooks not connected. Visit /api/quickbooks/connect to authorise.');
  }

  if (new Date() >= new Date(tokens.expires_at)) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    await saveTokens({ ...refreshed, realm_id: tokens.realm_id });
    return { access_token: refreshed.access_token, realm_id: tokens.realm_id };
  }

  return { access_token: tokens.access_token, realm_id: tokens.realm_id };
}

// ── QB REST helper ───────────────────────────────────────────

async function qbRequest(method, path, body) {
  const { access_token, realm_id } = await getValidToken();
  const url = `${QB_BASE}/v3/company/${realm_id}${path}?minorversion=65`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.Fault || data));
  return data;
}

// ── Customer ─────────────────────────────────────────────────

async function findOrCreateCustomer(name, phone, email) {
  // Search by display name
  const safe = name.replace(/'/g, "\\'");
  const searchRes = await qbRequest(
    'GET',
    `/query?query=SELECT * FROM Customer WHERE DisplayName = '${safe}'`
  );
  const existing = searchRes.QueryResponse?.Customer?.[0];
  if (existing) return existing.Id;

  // Create new
  const body = {
    DisplayName: name,
    PrimaryPhone:     phone ? { FreeFormNumber: phone }  : undefined,
    PrimaryEmailAddr: email ? { Address: email }         : undefined,
  };
  const created = await qbRequest('POST', '/customer', { Customer: body });
  return created.Customer.Id;
}

// ── Invoice (payment-link flow) ───────────────────────────────

async function createInvoice({ customerName, phone, email, address, lineItems, notes }) {
  const customerId = await findOrCreateCustomer(customerName, phone, email);

  const lines = lineItems.map((item, i) => ({
    LineNum: i + 1,
    Description: item.description,
    Amount: item.total,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: { value: '1', name: 'Services' },
      UnitPrice: item.total,
      Qty: 1,
    },
  }));

  const invoice = {
    CustomerRef: { value: customerId },
    Line: lines,
    CustomerMemo: notes   ? { value: notes }   : undefined,
    BillAddr:     address ? { Line1: address }  : undefined,
  };

  const res = await qbRequest('POST', '/invoice', { Invoice: invoice });
  return res.Invoice;
}

// ── Sales Receipt (cash / check — already paid) ───────────────

async function createSalesReceipt({ customerName, phone, email, address, lineItems, paymentMethod, notes }) {
  const customerId = await findOrCreateCustomer(customerName, phone, email);

  const pmRef = paymentMethod?.toLowerCase().includes('check')
    ? { value: '2', name: 'Check' }
    : { value: '1', name: 'Cash' };

  const lines = lineItems.map((item, i) => ({
    LineNum: i + 1,
    Description: item.description,
    Amount: item.total,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: { value: '1', name: 'Services' },
      UnitPrice: item.total,
      Qty: 1,
    },
  }));

  const receipt = {
    CustomerRef:      { value: customerId },
    PaymentMethodRef: pmRef,
    Line:             lines,
    CustomerMemo:     notes   ? { value: notes }   : undefined,
    BillAddr:         address ? { Line1: address }  : undefined,
  };

  const res = await qbRequest('POST', '/salesreceipt', { SalesReceipt: receipt });
  return res.SalesReceipt;
}

// ── Payment link ──────────────────────────────────────────────

function getInvoiceLink(invoice) {
  return `https://app.qbo.intuit.com/app/invoice?txnId=${invoice.Id}`;
}

// ── OAuth helpers ─────────────────────────────────────────────

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         process.env.QB_SCOPE || 'com.intuit.quickbooks.accounting',
    state:         state || 'stump-pros',
  });
  return `${AUTH_URL}?${params}`;
}

async function exchangeCode(code) {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Code exchange failed');
  return data;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  saveTokens,
  getTokens,
  createInvoice,
  createSalesReceipt,
  getInvoiceLink,
};
