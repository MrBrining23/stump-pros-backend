const { useState, useEffect, useCallback, useRef } = React;

// ============================================================
// STUMP PROS WV - FIELD SERVICE APP
// ============================================================

const API_BASE = "/api";

// ============================================================
// THEME & CONSTANTS
// ============================================================
const COLORS = {
  bg: "#1a1a1a",
  surface: "#242424",
  surfaceHover: "#2e2e2e",
  surfaceActive: "#333333",
  border: "#383838",
  borderLight: "#444444",
  text: "#e8e4de",
  textMuted: "#8a8580",
  textDim: "#5c5954",
  accent: "#c4a43e",
  accentDim: "#8a7420",
  green: "#4a9e6d",
  greenDim: "#2d5f42",
  red: "#c4503e",
  redDim: "#7a3228",
  blue: "#4a7ec4",
  blueDim: "#2d4d7a",
  orange: "#c4803e",
  orangeDim: "#7a5028",
  purple: "#9b59b6",
  purpleDim: "#5d3572",
};

const STATUS_CONFIG = {
  // Lead statuses
  new: { label: "New", color: COLORS.accent, bg: COLORS.accentDim + "40" },
  contacted: { label: "Contacted", color: COLORS.blue, bg: COLORS.blueDim + "40" },
  quoted: { label: "Quoted", color: COLORS.orange, bg: COLORS.orangeDim + "40" },
  converted: { label: "Converted", color: COLORS.green, bg: COLORS.greenDim + "40" },
  lost: { label: "Lost", color: COLORS.red, bg: COLORS.redDim + "40" },
  // Job statuses
  estimate: { label: "Estimate", color: COLORS.textMuted, bg: COLORS.border + "60" },
  scheduled: { label: "Scheduled", color: COLORS.blue, bg: COLORS.blueDim + "40" },
  in_progress: { label: "In Progress", color: COLORS.orange, bg: COLORS.orangeDim + "40" },
  completed: { label: "Completed", color: COLORS.green, bg: COLORS.greenDim + "40" },
  invoiced: { label: "Invoiced", color: COLORS.accent, bg: COLORS.accentDim + "40" },
  paid: { label: "Paid", color: COLORS.green, bg: COLORS.greenDim + "40" },
  // Estimate (quote) statuses
  pending: { label: "Pending", color: COLORS.accent, bg: COLORS.accentDim + "40" },
  approved: { label: "Approved", color: COLORS.green, bg: COLORS.greenDim + "40" },
  declined: { label: "Declined", color: COLORS.red, bg: COLORS.redDim + "40" },
  discount_offered: { label: "Offer Sent", color: COLORS.blue, bg: COLORS.blueDim + "40" },
  discount_approved: { label: "Disc. Approved", color: COLORS.green, bg: COLORS.greenDim + "40" },
  expired: { label: "Expired", color: COLORS.textMuted, bg: COLORS.border + "60" },
  // Invoice statuses
  draft: { label: "Draft", color: COLORS.textMuted, bg: COLORS.border + "60" },
  sent: { label: "Sent", color: COLORS.blue, bg: COLORS.blueDim + "40" },
};

const PACKAGES = {
  economy: { label: "Economy", desc: "Surface grind" },
  deluxe: { label: "Deluxe", desc: '6" below surface' },
  executive: { label: "Executive", desc: "Full root removal" },
};

const SOURCE_ICONS = { website: "🌐", facebook: "📘", instagram: "📸" };
const PREF_ICONS = { call: "📞", text: "💬", email: "📧" };

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return "$0";
  return `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================
// COMPONENTS
// ============================================================
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, color: COLORS.textMuted, bg: COLORS.border };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "4px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
      color: config.color, background: config.bg, border: `1px solid ${config.color}30`,
    }}>
      {config.label}
    </span>
  );
}

function IconButton({ icon, label, onClick, active, badge }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
      background: "none", border: "none", padding: "8px 10px", cursor: "pointer",
      color: active ? COLORS.accent : COLORS.textMuted, position: "relative",
      transition: "color 0.15s",
    }}>
      <span style={{ fontSize: "20px", lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.3px" }}>{label}</span>
      {badge > 0 && (
        <span style={{
          position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px",
          borderRadius: "50%", background: COLORS.red, color: "#fff",
          fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
        }}>{badge}</span>
      )}
    </button>
  );
}

function Card({ children, onClick, style }) {
  return (
    <div onClick={onClick} style={{
      background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
      padding: "14px 16px", cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.15s, background 0.15s",
      ...style,
    }}
    onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = COLORS.borderLight; e.currentTarget.style.background = COLORS.surfaceHover; }}}
    onMouseLeave={e => { if (onClick) { e.currentTarget.style.borderColor = (style && style.borderColor) ? style.borderColor : COLORS.border; e.currentTarget.style.background = COLORS.surface; }}}
    >
      {children}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: COLORS.textDim }}>
      <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: COLORS.textMuted, marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "13px" }}>{subtitle}</div>
    </div>
  );
}

function SectionHeader({ title, count, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", padding: "0 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: COLORS.text, letterSpacing: "-0.3px" }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontSize: "11px", fontWeight: 700, color: COLORS.textMuted,
            background: COLORS.border + "80", padding: "2px 8px", borderRadius: "10px",
          }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================
// LEAD CARD
// ============================================================
function LeadCard({ lead, onClick }) {
  const isNew = lead.status === "new" && !lead.auto_contacted;
  return (
    <Card onClick={onClick} style={isNew ? { borderColor: COLORS.accentDim, borderLeftWidth: "3px" } : {}}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text }}>{lead.name}</div>
          <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>
            {SOURCE_ICONS[lead.source]} {lead.source} · {PREF_ICONS[lead.contact_preference]} {lead.contact_preference}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <StatusBadge status={lead.status} />
          <span style={{ fontSize: "11px", color: COLORS.textDim }}>{timeAgo(lead.created_at)}</span>
        </div>
      </div>
      {lead.address && (
        <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ opacity: 0.6 }}>📍</span> {lead.address}
        </div>
      )}
      {lead.auto_contacted && (
        <div style={{ fontSize: "11px", color: COLORS.green, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
          ✓ Auto-responded {lead.auto_contacted_at ? timeAgo(lead.auto_contacted_at) : ""}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// JOB CARD
// ============================================================
function JobCard({ job, onClick }) {
  return (
    <Card onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text }}>{job.customer_name}</div>
          <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>
            {job.package && PACKAGES[job.package] ? PACKAGES[job.package].label : "No package"}
            {job.stump_count ? ` · ${job.stump_count} stump${job.stump_count > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <StatusBadge status={job.status} />
          {job.amount && <span style={{ fontSize: "14px", fontWeight: 700, color: COLORS.accent }}>{formatCurrency(job.amount)}</span>}
        </div>
      </div>
      <div style={{ fontSize: "12px", color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ opacity: 0.6 }}>📍</span> {job.address}
      </div>
      {job.scheduled_date && (
        <div style={{ fontSize: "12px", color: COLORS.blue, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
          📅 {formatDate(job.scheduled_date)} {job.scheduled_time ? `at ${formatTime(job.scheduled_time)}` : ""}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// ESTIMATE CARD
// ============================================================
function EstimateCard({ estimate, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: COLORS.surface, borderRadius: "10px", padding: "14px",
      border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${COLORS.accent}`,
      cursor: "pointer",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: COLORS.accent, textTransform: "uppercase" }}>📋 ESTIMATE</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text }}>{estimate.customer_name}</div>
          {estimate.address && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>📍 {estimate.address}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <StatusBadge status={estimate.status} />
          <span style={{ fontSize: "14px", fontWeight: 800, color: COLORS.accent }}>
            {formatCurrency(estimate.total_amount || estimate.amount)}
          </span>
        </div>
      </div>
      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px" }}>
        {estimate.sent_at ? `Sent ${timeAgo(estimate.sent_at)}` : `Created ${timeAgo(estimate.created_at)}`}
        {estimate.stump_count ? ` · ${estimate.stump_count} stump${estimate.stump_count > 1 ? "s" : ""}` : ""}
      </div>
    </div>
  );
}

// ============================================================
// INVOICE CARD
// ============================================================
function InvoiceCard({ invoice, onClick }) {
  return (
    <Card onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text }}>{invoice.customer_name}</div>
          {invoice.address && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>📍 {invoice.address}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <StatusBadge status={invoice.status} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: COLORS.accent }}>{formatCurrency(invoice.total)}</span>
        </div>
      </div>
      {invoice.qb_invoice_id && (
        <div style={{ fontSize: "11px", color: COLORS.green, marginTop: "4px" }}>✓ Synced to QuickBooks</div>
      )}
      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "4px" }}>{timeAgo(invoice.created_at)}</div>
    </Card>
  );
}

// ============================================================
// LEAD DETAIL VIEW
// ============================================================
function LeadDetail({ lead, onBack, onConvert, onUpdateStatus }) {
  const [status, setStatus] = useState(lead.status);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    onUpdateStatus(lead.id, newStatus);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: COLORS.accent, cursor: "pointer",
        fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px",
      }}>
        ← Back to Leads
      </button>

      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.5px" }}>{lead.name}</h2>
            <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "4px" }}>
              {SOURCE_ICONS[lead.source]} {lead.source} · {PREF_ICONS[lead.contact_preference]} prefers {lead.contact_preference}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>📞</span>
            <div><div style={{ fontWeight: 600 }}>{lead.phone}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to call</div></div>
          </a>
        )}
        {lead.phone && (
          <a href={`sms:${lead.phone}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>💬</span>
            <div><div style={{ fontWeight: 600 }}>Send a text</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Opens Messages app</div></div>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>📧</span>
            <div><div style={{ fontWeight: 600 }}>{lead.email}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to email</div></div>
          </a>
        )}
        {lead.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <div><div style={{ fontWeight: 600 }}>{lead.address}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap for directions</div></div>
          </a>
        )}
      </div>

      {lead.notes && (
        <Card style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Notes</div>
          <div style={{ fontSize: "14px", color: COLORS.text, lineHeight: 1.5 }}>{lead.notes}</div>
        </Card>
      )}

      {lead.auto_contacted && (
        <Card style={{ marginBottom: "20px", borderColor: COLORS.greenDim + "60" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: COLORS.green, fontSize: "13px" }}>
            <span>✓</span>
            <span style={{ fontWeight: 600 }}>Auto-responded</span>
            <span style={{ color: COLORS.textDim }}>· {timeAgo(lead.auto_contacted_at)}</span>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Update Status</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {["new", "contacted", "quoted", "converted", "lost"].map(s => (
            <button key={s} onClick={() => handleStatusChange(s)} style={{
              padding: "8px 14px", borderRadius: "6px", border: `1px solid ${STATUS_CONFIG[s].color}40`,
              background: status === s ? STATUS_CONFIG[s].bg : "transparent",
              color: status === s ? STATUS_CONFIG[s].color : COLORS.textMuted,
              cursor: "pointer", fontSize: "12px", fontWeight: 600, transition: "all 0.15s",
            }}>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {status !== "converted" && status !== "lost" && (
        <button onClick={() => onConvert(lead)} style={{
          width: "100%", padding: "14px", borderRadius: "8px", border: "none",
          background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800,
          cursor: "pointer", letterSpacing: "0.3px",
        }}>
          Convert to Job →
        </button>
      )}
    </div>
  );
}

// ============================================================
// JOB PAYMENT ACTIONS  (QuickBooks invoice link / cash / check)
// ============================================================
function JobPaymentActions({ job, onRefresh }) {
  const [loading, setLoading] = useState(null);
  const [done, setDone]       = useState(null);

  async function requestPayment() {
    setLoading('link');
    try {
      const res = await fetch(`${API_BASE}/quickbooks/jobs/${job.id}/request-payment`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(job.phone ? `Payment link sent to ${job.phone}` : 'Invoice created in QuickBooks');
      onRefresh && onRefresh();
    } catch (e) { alert(e.message); }
    finally { setLoading(null); }
  }

  async function markPaid(method) {
    const sendReceipt = job.phone ? confirm(`Send SMS receipt to ${job.phone}?`) : false;
    setLoading(method);
    try {
      const res = await fetch(`${API_BASE}/quickbooks/jobs/${job.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: method, send_receipt: sendReceipt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone('Marked paid in QuickBooks ✓');
      onRefresh && onRefresh();
    } catch (e) { alert(e.message); }
    finally { setLoading(null); }
  }

  if (done) {
    return (
      <div style={{ color: COLORS.green, fontSize: 13, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>✓</span><span>{done}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Payment</div>
      <button
        onClick={requestPayment}
        disabled={!!loading}
        style={{
          padding: '11px 16px', borderRadius: 8, border: 'none',
          background: COLORS.green, color: '#fff',
          fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading === 'link' ? 'Sending…' : '💳 Send Payment Link'}
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => markPaid('cash')}
          disabled={!!loading}
          style={{
            flex: 1, padding: '9px 8px', borderRadius: 8,
            border: `1px solid ${COLORS.borderLight}`, background: 'transparent',
            color: COLORS.text, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading === 'cash' ? '…' : '💵 Cash'}
        </button>
        <button
          onClick={() => markPaid('check')}
          disabled={!!loading}
          style={{
            flex: 1, padding: '9px 8px', borderRadius: 8,
            border: `1px solid ${COLORS.borderLight}`, background: 'transparent',
            color: COLORS.text, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading === 'check' ? '…' : '📝 Check'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// JOB DETAIL VIEW
// ============================================================
function JobDetail({ job, onBack, onUpdateStatus, onSendEstimate, onRefresh }) {
  const [status, setStatus] = useState(job.status);
  const statuses = ["estimate", "scheduled", "in_progress", "completed", "invoiced", "paid"];

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    onUpdateStatus(job.id, newStatus);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: COLORS.accent, cursor: "pointer",
        fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px",
      }}>
        ← Back to Jobs
      </button>

      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.5px" }}>{job.customer_name}</h2>
            <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "4px" }}>
              {job.package && PACKAGES[job.package] ? `${PACKAGES[job.package].label} — ${PACKAGES[job.package].desc}` : "No package selected"}
            </div>
          </div>
          {job.amount && <span style={{ fontSize: "22px", fontWeight: 800, color: COLORS.accent }}>{formatCurrency(job.amount)}</span>}
        </div>
      </div>

      {job.scheduled_date && (
        <Card style={{ marginBottom: "12px", borderColor: COLORS.blueDim + "60" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>📅</span>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: COLORS.text }}>{formatDate(job.scheduled_date)}</div>
              {job.scheduled_time && <div style={{ fontSize: "13px", color: COLORS.blue }}>{formatTime(job.scheduled_time)}</div>}
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        {job.phone && (
          <a href={`tel:${job.phone}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>📞</span>
            <div><div style={{ fontWeight: 600 }}>{job.phone}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to call</div></div>
          </a>
        )}
        {job.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, color: COLORS.text, textDecoration: "none", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <div><div style={{ fontWeight: 600 }}>{job.address}</div><div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap for directions</div></div>
          </a>
        )}
      </div>

      {job.stump_count && (
        <Card style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🪵</span>
            <span style={{ fontSize: "15px", fontWeight: 600, color: COLORS.text }}>{job.stump_count} stump{job.stump_count > 1 ? "s" : ""}</span>
          </div>
        </Card>
      )}

      {job.notes && (
        <Card style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Notes</div>
          <div style={{ fontSize: "14px", color: COLORS.text, lineHeight: 1.5 }}>{job.notes}</div>
        </Card>
      )}

      {/* Status Pipeline */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Job Pipeline</div>
        <div style={{ display: "flex", gap: "3px" }}>
          {statuses.map((s, i) => {
            const currentIdx = statuses.indexOf(status);
            const isCompleted = i <= currentIdx;
            const isCurrent = s === status;
            return (
              <button key={s} onClick={() => handleStatusChange(s)} style={{
                flex: 1, padding: "10px 4px",
                borderRadius: i === 0 ? "6px 0 0 6px" : i === statuses.length - 1 ? "0 6px 6px 0" : "0",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: isCompleted ? (isCurrent ? STATUS_CONFIG[s].color : STATUS_CONFIG[s].color + "50") : COLORS.border + "40",
                color: isCompleted ? "#fff" : COLORS.textDim,
                fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px",
              }}>
                {STATUS_CONFIG[s].label}
              </button>
            );
          })}
        </div>
      </div>

      {status === "completed" && (
        <Card style={{ borderColor: COLORS.greenDim + "60", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: COLORS.green, fontSize: "13px" }}>
            <span>✓</span>
            <span style={{ fontWeight: 600 }}>Review request will be sent in 24 hours</span>
          </div>
        </Card>
      )}

      <button onClick={() => onSendEstimate(job)} style={{
        width: "100%", padding: "13px", borderRadius: "8px", border: `1px solid ${COLORS.accentDim}`,
        background: "transparent", color: COLORS.accent, fontSize: "14px", fontWeight: 700,
        cursor: "pointer", marginTop: "8px",
      }}>
        📋 Send Estimate
      </button>

      <JobPaymentActions job={job} onRefresh={onRefresh} />
    </div>
  );
}

// ============================================================
// ESTIMATE DETAIL VIEW (admin)
// ============================================================
function EstimateDetail({ estimate, onBack, onCreateInvoice, onRefresh }) {
  const [sending, setSending] = useState(false);
  const [localStatus, setLocalStatus] = useState(estimate.status);

  const handleSendDiscount = async () => {
    if (!confirm("Send a discount offer SMS to this customer?")) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/estimates/${estimate.id}/send-discount`, { method: "POST" });
      const data = await res.json();
      setLocalStatus(data.status || "discount_offered");
      onRefresh && onRefresh();
    } catch (err) {
      alert("Failed to send discount: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const canSendDiscount = ["pending", "declined", "discount_offered"].includes(localStatus);
  const canCreateInvoice = ["approved", "discount_approved"].includes(localStatus);

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: COLORS.accent, cursor: "pointer",
        fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px",
      }}>
        ← Back to Billing
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.5px" }}>{estimate.customer_name}</h2>
          {estimate.address && <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "4px" }}>📍 {estimate.address}</div>}
        </div>
        <StatusBadge status={localStatus} />
      </div>

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Estimate Amount</div>
        <div style={{ fontSize: "28px", fontWeight: 900, color: COLORS.accent, letterSpacing: "-1px" }}>{formatCurrency(estimate.amount)}</div>
        {estimate.discounted_amount && (
          <div style={{ fontSize: "13px", color: COLORS.blue, marginTop: "4px" }}>
            Discount offer: {formatCurrency(estimate.discounted_amount)} ({estimate.discount_pct}% off)
          </div>
        )}
      </Card>

      {estimate.description && (
        <Card style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Description</div>
          <div style={{ fontSize: "14px", color: COLORS.text, lineHeight: 1.5 }}>{estimate.description}</div>
        </Card>
      )}

      {estimate.notes && (
        <Card style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Notes</div>
          <div style={{ fontSize: "14px", color: COLORS.text, lineHeight: 1.5 }}>{estimate.notes}</div>
        </Card>
      )}

      <Card style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Timeline</div>
        {estimate.sent_at && <div style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "4px" }}>📤 Sent {timeAgo(estimate.sent_at)}</div>}
        {estimate.responded_at && <div style={{ fontSize: "13px", color: COLORS.textMuted }}>💬 Responded {timeAgo(estimate.responded_at)}</div>}
        {!estimate.sent_at && <div style={{ fontSize: "13px", color: COLORS.textDim }}>Not yet sent</div>}
      </Card>

      {canCreateInvoice && (
        <button onClick={() => onCreateInvoice(estimate)} style={{
          width: "100%", padding: "14px", borderRadius: "8px", border: "none",
          background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800,
          cursor: "pointer", marginBottom: "10px",
        }}>
          🧾 Create Invoice
        </button>
      )}

      {canSendDiscount && (
        <button onClick={handleSendDiscount} disabled={sending} style={{
          width: "100%", padding: "13px", borderRadius: "8px", border: `1px solid ${COLORS.blueDim}`,
          background: "transparent", color: COLORS.blue, fontSize: "14px", fontWeight: 700,
          cursor: "pointer", opacity: sending ? 0.6 : 1,
        }}>
          {sending ? "Sending..." : localStatus === "discount_offered" ? "🔄 Resend Discount Offer" : "💸 Send Discount Offer"}
        </button>
      )}
    </div>
  );
}

// ============================================================
// INVOICE DETAIL VIEW
// ============================================================
function InvoiceDetail({ invoice, onBack, onUpdateStatus }) {
  const [status, setStatus] = useState(invoice.status);
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : (typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : []);

  const handleStatus = (s) => {
    setStatus(s);
    onUpdateStatus(invoice.id, s);
  };

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: COLORS.accent, cursor: "pointer",
        fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px",
      }}>
        ← Back to Billing
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.5px" }}>{invoice.customer_name}</h2>
          {invoice.address && <div style={{ color: COLORS.textMuted, fontSize: "13px", marginTop: "4px" }}>📍 {invoice.address}</div>}
        </div>
        <StatusBadge status={status} />
      </div>

      {lineItems.length > 0 && (
        <Card style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Line Items</div>
          {lineItems.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "8px", marginBottom: "8px", borderBottom: i < lineItems.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: COLORS.text }}>{item.description}</div>
                {(item.quantity > 1) && <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Qty: {item.quantity}</div>}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: COLORS.accent, marginLeft: "12px" }}>
                {formatCurrency((parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 1))}
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${COLORS.borderLight}`, paddingTop: "10px", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: COLORS.textMuted, marginBottom: "4px" }}>
              <span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.tax_pct) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: COLORS.textMuted, marginBottom: "4px" }}>
                <span>Tax ({invoice.tax_pct}%)</span><span>{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, color: COLORS.accent, marginTop: "6px" }}>
              <span>Total</span><span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </Card>
      )}

      {invoice.qb_invoice_url && (
        <a href={invoice.qb_invoice_url} target="_blank" rel="noopener noreferrer" style={{
          display: "block", padding: "12px 16px", background: COLORS.surface, borderRadius: "8px",
          border: `1px solid ${COLORS.greenDim}60`, color: COLORS.green, textDecoration: "none",
          fontSize: "13px", fontWeight: 600, marginBottom: "12px", textAlign: "center",
        }}>
          ✓ View in QuickBooks →
        </a>
      )}

      {invoice.notes && (
        <Card style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Notes</div>
          <div style={{ fontSize: "14px", color: COLORS.text, lineHeight: 1.5 }}>{invoice.notes}</div>
        </Card>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Mark As</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["draft", "sent", "paid"].map(s => (
            <button key={s} onClick={() => handleStatus(s)} style={{
              flex: 1, padding: "10px 8px", borderRadius: "6px", border: `1px solid ${STATUS_CONFIG[s].color}40`,
              background: status === s ? STATUS_CONFIG[s].bg : "transparent",
              color: status === s ? STATUS_CONFIG[s].color : COLORS.textMuted,
              cursor: "pointer", fontSize: "12px", fontWeight: 600,
            }}>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NEW LEAD FORM
// ============================================================
function NewLeadScreen({ onBack, onSave }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", source: "website", source_other: "", contact_preference: "text", notes: "" });
  const [customerId, setCustomerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const finalSource = form.source === "other" ? (form.source_other || "other") : form.source;
      const res = await fetch(`${API_BASE}/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: finalSource, customer_id: customerId }),
      });
      const lead = await res.json();
      onSave(lead);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
      <SectionHeader title="New Lead" />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
        <div>
          <label style={labelStyle}>Customer</label>
          <CustomerSelector
            initialName={form.name}
            onSelect={(c) => { if (c) { set("name", c.name); set("phone", c.phone || ""); set("email", c.email || ""); set("address", c.address || ""); setCustomerId(c.id); } else { set("name", ""); setCustomerId(null); } }}
            placeholder="Search existing or type new name..."
          />
          {!form.name && <input style={{ ...inputStyle, marginTop: "8px" }} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Or type name manually *" />}
        </div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="304-555-0000" /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, Charleston, WV" /></div>
        <div>
          <label style={labelStyle}>Source</label>
          <select style={inputStyle} value={form.source} onChange={e => set("source", e.target.value)}>
            <option value="website">Website</option>
            <option value="google">Google</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="other">Other</option>
          </select>
          {form.source === "other" && (
            <input style={{ ...inputStyle, marginTop: "8px" }} value={form.source_other} onChange={e => set("source_other", e.target.value)} placeholder="Where did they hear about you?" />
          )}
        </div>
        <div>
          <label style={labelStyle}>Contact Preference</label>
          <select style={inputStyle} value={form.contact_preference} onChange={e => set("contact_preference", e.target.value)}>
            <option value="text">Text</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes..." /></div>
      </div>
      <button onClick={handleSave} disabled={saving || !form.name} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800, cursor: "pointer", opacity: saving || !form.name ? 0.6 : 1 }}>
        {saving ? "Saving..." : "Add Lead"}
      </button>
    </div>
  );
}

// ============================================================
// NEW JOB FORM
// ============================================================
function NewJobScreen({ onBack, onSave }) {
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "", package: "economy", stump_count: "", scheduled_date: "", scheduled_time: "", amount: "", notes: "" });
  const [customerId, setCustomerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleSave = async () => {
    if (!form.customer_name) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, stump_count: form.stump_count ? parseInt(form.stump_count) : null, amount: form.amount ? parseFloat(form.amount) : null, customer_id: customerId }),
      });
      const job = await res.json();
      onSave(job);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
      <SectionHeader title="New Job" />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
        <div>
          <label style={labelStyle}>Customer *</label>
          <CustomerSelector
            initialName={form.customer_name}
            onSelect={(c) => { if (c) { set("customer_name", c.name); set("phone", c.phone || ""); set("email", c.email || ""); set("address", c.address || ""); setCustomerId(c.id); } else { set("customer_name", ""); setCustomerId(null); } }}
            placeholder="Search existing or type new name..."
          />
          {!form.customer_name && <input style={{ ...inputStyle, marginTop: "8px" }} value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="Or type name manually *" />}
        </div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="304-555-0000" /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, Charleston, WV" /></div>
        <div>
          <label style={labelStyle}>Package</label>
          <select style={inputStyle} value={form.package} onChange={e => set("package", e.target.value)}>
            <option value="economy">Economy — Surface grind</option>
            <option value="deluxe">Deluxe — 6" below surface</option>
            <option value="executive">Executive — Full root removal</option>
          </select>
        </div>
        <div><label style={labelStyle}>Stump Count</label><input style={inputStyle} type="number" value={form.stump_count} onChange={e => set("stump_count", e.target.value)} placeholder="0" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div><label style={labelStyle}>Date</label><input style={inputStyle} type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} /></div>
          <div><label style={labelStyle}>Time</label><input style={inputStyle} type="time" value={form.scheduled_time} onChange={e => set("scheduled_time", e.target.value)} /></div>
        </div>
        <div><label style={labelStyle}>Amount ($)</label><input style={inputStyle} type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" /></div>
        <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes..." /></div>
      </div>
      <button onClick={handleSave} disabled={saving || !form.customer_name} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800, cursor: "pointer", opacity: saving || !form.customer_name ? 0.6 : 1 }}>
        {saving ? "Saving..." : "Create Job"}
      </button>
    </div>
  );
}


// ============================================================
// ESTIMATE BUILDER (replaces NewEstimateScreen)
// ============================================================
/**
 * EstimateBuilder.jsx — Stump Pros WV
 * Full flow: Build → Save → Upload Photos → Send or Accept On-Site
 */


// ── Pricing constants ──────────────────────────────────────────────────────
const PRICE_PER_INCH = 5.00;
const MIN_PER_STUMP  = 50.00;
const MIN_PER_JOB    = 225.00;

// add = fractional surcharge added to 1.0 base (additive, not compounding)
// e.g. hard: 0.15 means base × (1 + 0.15 + other_adds...)
const DIFFICULTY_OPTS = [
  { value: "normal",      label: "Normal",      add: 0.00 },
  { value: "hard",        label: "Hard",        add: 0.15 },
  { value: "very_dense",  label: "Very Dense",  add: 0.25 },
  { value: "decomposing", label: "Decomposing", add: -0.15 },
];
const ACCESS_OPTS = [
  { value: "open",         label: "Open",         add: 0.00 },
  { value: "limited",      label: "Limited",      add: 0.20 },
  { value: "very_limited", label: "Very Limited", add: 0.35 },
];
const HEIGHT_OPTS = [
  { value: "flush", label: 'Flush–6"', add: 0.00 },
  { value: "mid",   label: '7–15"',   add: 0.15 },
  { value: "tall",  label: '16"+',    add: 0.25 },
];
const CLEANUP_OPTS = [
  { value: "none",         label: "None",             add: 0.00 },
  { value: "chips_only",   label: "Chips",            add: 0.50 },
  { value: "full_cleanup", label: "Full Restoration", add: 1.00 },
];
const ROOTS_OPTS = [
  { value: "none",      label: "None / Minimal",       add: 0.00 },
  { value: "surface",   label: "Mound / Surface Roots", add: 0.25 },
  { value: "full_yard", label: "Whole Area / Yard",     add: 0.60 },
];

const CAPTION_SUGGESTIONS = ["Before", "After", "Stump 1", "Stump 2", "Access", "Roots"];

// ── Google Places address autocomplete ───────────────────────────────────────
// Falls back to a plain text input if Maps API is not loaded (no API key set).
function PlacesAutocomplete({ value, onChange, style, placeholder }) {
  const inputRef   = useRef(null);
  const acRef      = useRef(null);
  const [ready, setReady] = useState(!!window.google?.maps?.places);

  // Init autocomplete once Maps is available
  const init = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || acRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['formatted_address', 'address_components'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      const get  = t => (place.address_components.find(c => c.types.includes(t)) || {}).long_name  || '';
      const getS = t => (place.address_components.find(c => c.types.includes(t)) || {}).short_name || '';
      const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
      const city   = get('locality') || get('sublocality') || get('administrative_area_level_3');
      const state  = getS('administrative_area_level_1');
      const zip    = get('postal_code');
      onChange([street, city, state, zip].filter(Boolean).join(', '));
    });
    acRef.current = ac;
    setReady(true);
  }, [onChange]);

  useEffect(() => {
    init();
    window.addEventListener('google-maps-ready', init);
    return () => window.removeEventListener('google-maps-ready', init);
  }, [init]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => { const v = e.target.value; onChange(v); }}
      style={style}
      placeholder={placeholder || 'Service Address'}
      autoComplete={ready ? 'off' : 'street-address'}
    />
  );
}

// ── Customer Picker Modal ─────────────────────────────────────────────────
function CustomerPickerModal({ onSelect, onClose }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/leads`)
      .then(r => r.json())
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l =>
    !search ||
    (l.name  && l.name.toLowerCase().includes(search.toLowerCase())) ||
    (l.phone && l.phone.includes(search))
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:"#1a1a2e", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:520, margin:"0 auto", maxHeight:"80vh", display:"flex", flexDirection:"column", paddingBottom:"env(safe-area-inset-bottom)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px 12px", borderBottom:"1px solid #2a2a3e" }}>
          <span style={{ fontWeight:800, fontSize:17, color:"#f0ece4" }}>Load Customer</span>
          <button type="button" onClick={onClose} style={{ background:"none", border:"none", color:"#777", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:"12px 16px" }}>
          <input
            autoFocus
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width:"100%", background:"#0d0d1a", border:"1px solid #333", borderRadius:8, color:"#f0ece4", fontSize:15, padding:"10px 14px", boxSizing:"border-box", fontFamily:"inherit", outline:"none" }}
          />
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>
          {loading && <div style={{ textAlign:"center", color:"#777", padding:24 }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={{ textAlign:"center", color:"#777", padding:24 }}>No leads found</div>}
          {filtered.map(l => (
            <div key={l.id}
              onMouseDown={() => onSelect(l)}
              style={{ padding:"12px 20px", borderBottom:"1px solid #2a2a3e", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background="#1e2040"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}
            >
              <div style={{ fontWeight:700, fontSize:14, color:"#f0ece4" }}>{l.name}</div>
              <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{[l.phone, l.address].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function calcStump(s) {
  const d = parseFloat(s.diameter);
  if (!d || d <= 0) return 0;
  const rate = d > 40 ? 6.00 : PRICE_PER_INCH;
  const base = Math.max(d * rate, MIN_PER_STUMP);

  // Each option adds its percentage to the base — no compounding
  const adds =
    (DIFFICULTY_OPTS.find(o => o.value === s.difficulty)?.add       ?? 0) +
    (ACCESS_OPTS.find(o => o.value === s.access)?.add                ?? 0) +
    (HEIGHT_OPTS.find(o => o.value === (s.height||"flush"))?.add     ?? 0) +
    (CLEANUP_OPTS.find(o => o.value === s.cleanup)?.add              ?? 0) +
    (ROOTS_OPTS.find(o => o.value === s.roots)?.add                  ?? 0) +
    (s.rocky      ? 0.20 : 0) +
    (s.extra_deep ? 0.20 : 0);

  return Math.round(base * (1 + adds) * 100) / 100;
}
function volumeDiscount(count) {
  return count >= 21 ? 0.25 : count >= 11 ? 0.20 : count >= 5 ? 0.15 : 0;
}
function calcJob(stumps) {
  const disc = volumeDiscount(stumps.length);
  const sum  = stumps.reduce((a, s) => a + calcStump(s) * (1 - disc), 0);
  return Math.max(sum, MIN_PER_JOB);
}
function fmt(n) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
function newStump(i) {
  return { id: Date.now() + i, diameter: "", difficulty: "normal",
           access: "open", height: "flush", cleanup: "none", roots: "none",
           rocky: false, extra_deep: false, notes: "" };
}

// ── Segment selector ─────────────────────────────────────────────────────
function Segs({ label, value, onChange, options }) {
  return (
    <div style={s.segWrap}>
      <span style={s.segLbl}>{label}</span>
      <div style={s.segs}>
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{ ...s.seg, ...(value === o.value ? s.segOn : {}) }}>
            {o.label}{o.add !== 0 && <span style={s.badge}> {o.add > 0 ? `+${Math.round(o.add*100)}%` : `${Math.round(o.add*100)}%`}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Stump card ───────────────────────────────────────────────────────────
function StumpCard({ stump, index, onChange, onRemove, canRemove, photos, onPhotosChange }) {
  const sub    = calcStump(stump);
  const hasMin = stump.diameter && parseFloat(stump.diameter) > 0 && sub === MIN_PER_STUMP;
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={s.numBadge}>#{index + 1}</span>
          <span style={{ fontWeight:700, fontSize:14 }}>Stump</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={s.subAmt}>{fmt(sub)}</span>
          {hasMin && <span style={s.minTag}>MIN</span>}
          {canRemove && <button type="button" onClick={onRemove} style={s.xBtn}>✕</button>}
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={s.fieldLbl}>Diameter</label>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <input type="number" min="1" max="120" step="0.5" placeholder="0"
            value={stump.diameter} onChange={e => onChange("diameter", e.target.value)}
            style={s.diamIn} />
          <span style={{ color:MUTED, fontSize:13 }}>inches</span>
          {stump.diameter > 0 && (
            <span style={s.baseHint}>${(parseFloat(stump.diameter) * (parseFloat(stump.diameter) > 40 ? 6 : 5)).toFixed(0)} base</span>
          )}
        </div>
      </div>
      <Segs label="Wood"    value={stump.difficulty} onChange={v=>onChange("difficulty",v)} options={DIFFICULTY_OPTS} />
      <Segs label="Access"  value={stump.access}     onChange={v=>onChange("access",v)}     options={ACCESS_OPTS} />
      <Segs label="Height"  value={stump.height||"flush"} onChange={v=>onChange("height",v)} options={HEIGHT_OPTS} />
      <Segs label="Cleanup" value={stump.cleanup}    onChange={v=>onChange("cleanup",v)}    options={CLEANUP_OPTS} />
      <Segs label="Roots"   value={stump.roots||"none"} onChange={v=>onChange("roots",v)}  options={ROOTS_OPTS} />

      {/* Rocky Soil checkbox */}
      <label style={{ display:"flex", alignItems:"center", gap:8, margin:"10px 0 6px", cursor:"pointer" }}>
        <input type="checkbox" checked={!!stump.rocky} onChange={e => onChange("rocky", e.target.checked)}
          style={{ width:18, height:18, accentColor:"#00ff88" }} />
        <span style={{ fontSize:13, color:"#ccc" }}>🪨 Rocky Soil <span style={{ color:"#00ff88", fontSize:11 }}>+20%</span></span>
      </label>

      {/* Extra Deep Grinding checkbox */}
      <label style={{ display:"flex", alignItems:"center", gap:8, margin:"6px 0 10px", cursor:"pointer" }}>
        <input type="checkbox" checked={!!stump.extra_deep} onChange={e => onChange("extra_deep", e.target.checked)}
          style={{ width:18, height:18, accentColor:"#00ff88" }} />
        <span style={{ fontSize:13, color:"#ccc" }}>⛏️ Extra Deep Grinding <span style={{ color:"#00ff88", fontSize:11 }}>+25%</span></span>
      </label>

      <input type="text" placeholder="Notes (optional)" value={stump.notes}
        onChange={e => onChange("notes", e.target.value)} style={s.notesIn} />

      {/* Inline photo picker */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
          {(photos||[]).map((f,i) => (
            <div key={i} style={{ position:"relative" }}>
              <img src={URL.createObjectURL(f)} style={{ width:64, height:64, objectFit:"cover", borderRadius:6, border:"1px solid #333" }} />
              <button type="button" onClick={() => onPhotosChange((photos||[]).filter((_,j)=>j!==i))}
                style={{ position:"absolute", top:-6, right:-6, background:"#ff4444", color:"#fff", border:"none", borderRadius:"50%", width:18, height:18, fontSize:11, cursor:"pointer", lineHeight:"18px", textAlign:"center", padding:0 }}>✕</button>
            </div>
          ))}
        </div>
        <label style={{ cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", border:"1px dashed #555", borderRadius:6, fontSize:12, color:"#888" }}>
          📷 Add Photo
          <input type="file" accept="image/*" multiple capture="environment" style={{ display:"none" }}
            onChange={e => onPhotosChange([...(photos||[]), ...Array.from(e.target.files)])} />
        </label>
      </div>
    </div>
  );
}

// ── Summary ──────────────────────────────────────────────────────────────
function Summary({ stumps }) {
  const disc      = volumeDiscount(stumps.length);
  const preDisc   = stumps.reduce((a,s) => a + calcStump(s), 0);
  const sum       = preDisc * (1 - disc);
  const total     = Math.max(sum, MIN_PER_JOB);
  const rounded   = Math.ceil(total / 25) * 25;
  return (
    <div style={s.summCard}>
      <div style={s.summTitle}>Summary</div>
      {stumps.map((st, i) => {
        const sub = calcStump(st);
        if (!st.diameter) return null;
        const tags = [
          st.difficulty !== "normal"  ? DIFFICULTY_OPTS.find(o=>o.value===st.difficulty)?.label : null,
          st.access !== "open"        ? ACCESS_OPTS.find(o=>o.value===st.access)?.label         : null,
          (st.height||"flush") !== "flush" ? HEIGHT_OPTS.find(o=>o.value===(st.height||"flush"))?.label : null,
          st.cleanup !== "none"       ? CLEANUP_OPTS.find(o=>o.value===st.cleanup)?.label       : null,
        ].filter(Boolean);
        return (
          <div key={st.id} style={s.summRow}>
            <span style={s.summItem}>
              Stump {i+1} — {st.diameter}"
              {tags.length > 0 && <span style={{ color:MUTED }}> · {tags.join(" · ")}</span>}
            </span>
            <span style={s.summAmt}>{fmt(sub)}</span>
          </div>
        );
      })}
      <div style={s.divider}/>
      {disc > 0 && (
        <div style={{ ...s.summRow, fontSize:12, color:"#00ff88", fontStyle:"italic" }}>
          <span>Volume discount ({Math.round(disc*100)}% · {stumps.length} stumps)</span>
          <span>−{fmt(preDisc * disc)}</span>
        </div>
      )}
      {total > sum && (
        <div style={{ ...s.summRow, fontSize:12, color:MUTED, fontStyle:"italic" }}>
          <span>Job minimum applied</span><span>{fmt(MIN_PER_JOB)}</span>
        </div>
      )}
      <div style={s.totalRow}><span>Total</span><span>{fmt(rounded)}</span></div>
    </div>
  );
}

// ── Photo Upload ─────────────────────────────────────────────────────────
function PhotoUpload({ estimateId, apiBase, photos, onPhotosChange }) {
  const fileRef    = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState(null);

  async function handleFiles(files) {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("photos", f));
      const res = await fetch(`${apiBase}/estimates/${estimateId}/photos`, {
        method: "POST", body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onPhotosChange([...photos, ...data]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function updateCaption(photoId, caption) {
    // Optimistic update locally (caption editing is cosmetic, no DB endpoint needed for now)
    onPhotosChange(photos.map(p => p.id === photoId ? { ...p, caption } : p));
  }

  async function removePhoto(photoId) {
    try {
      await fetch(`${apiBase}/estimates/${estimateId}/photos/${photoId}`, { method: "DELETE" });
      onPhotosChange(photos.filter(p => p.id !== photoId));
    } catch {
      setError("Failed to remove photo");
    }
  }

  return (
    <div>
      {/* Drop zone / tap to add */}
      <div
        style={{ ...s.dropZone, ...(uploading ? { opacity: 0.6 } : {}) }}
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <span style={{ color:MUTED }}>Uploading…</span>
        ) : (
          <>
            <span style={s.dropIcon}>📷</span>
            <span style={s.dropLabel}>Tap to add photos</span>
            <span style={s.dropSub}>Camera or gallery · up to 10 photos</span>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display:"none" }}
        onChange={e => handleFiles(e.target.files)}
      />

      {error && <div style={s.errBox}>{error}</div>}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={s.photoGrid}>
          {photos.map(p => (
            <div key={p.id} style={s.photoItem}>
              <div style={s.photoImgWrap}>
                <img
                  src={p.cloudinary_url}
                  alt={p.caption || "Job photo"}
                  style={s.photoImg}
                />
                <button type="button" onClick={() => removePhoto(p.id)} style={s.photoRemove}>✕</button>
              </div>
              {/* Caption — tap suggestion chips or type */}
              <div style={s.captionRow}>
                {CAPTION_SUGGESTIONS.map(c => (
                  <button key={c} type="button"
                    onClick={() => updateCaption(p.id, c)}
                    style={{ ...s.captionChip, ...(p.caption === c ? s.captionChipOn : {}) }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signature Pad ────────────────────────────────────────────────────────
function SignaturePad({ onCapture, onClear }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const lastPos   = useRef(null);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width),
             y: (src.clientY - rect.top)  * (canvas.height / rect.height) };
  }
  function start(e) { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current); }
  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current; const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.strokeStyle = "#c4a43e"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos;
  }
  function stop(e) { e.preventDefault(); drawing.current = false; onCapture(canvasRef.current.toDataURL()); }
  function clear() { canvasRef.current.getContext("2d").clearRect(0,0,640,160); onClear(); }

  return (
    <div>
      <div style={s.sigLbl}>Customer Signature</div>
      <div style={s.sigWrap}>
        <canvas ref={canvasRef} width={640} height={160} style={s.sigCanvas}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
        <span style={s.sigHint}>Sign above</span>
      </div>
      <button type="button" onClick={clear} style={s.clearBtn}>Clear</button>
    </div>
  );
}

// ── On-Site Modal ────────────────────────────────────────────────────────
function OnsiteModal({ estimate, apiBase, onSuccess, onClose }) {
  const [sigData, setSigData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function confirm(withSig) {
    setError(null); setLoading(true);
    try {
      const res = await fetch(`${apiBase}/estimates/${estimate.id}/accept-onsite`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ signature_data: withSig ? sigData : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSuccess(data);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <span style={{ fontWeight:800, fontSize:17 }}>Accept On-Site</span>
          <button type="button" onClick={onClose} style={s.modalClose}>✕</button>
        </div>
        <div style={{ padding:"0 20px 24px" }}>
          <div style={{ fontSize:14, color:MUTED, margin:"10px 0 20px" }}>
            {estimate.customer_name} · {fmt(estimate.total_amount)}
          </div>
          <SignaturePad onCapture={setSigData} onClear={() => setSigData(null)} />
          {error && <div style={s.errBox}>{error}</div>}
          <button type="button" onClick={() => confirm(true)}
            disabled={loading || !sigData}
            style={{ ...s.confirmBtn, opacity: (!sigData || loading) ? 0.5 : 1, marginTop:16 }}>
            {loading ? "Processing…" : "✓ Confirm with Signature"}
          </button>
          <button type="button" onClick={() => confirm(false)}
            style={{ ...s.confirmBtn, background:"#333", marginTop:8 }}>
            Accept Without Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success Screen ───────────────────────────────────────────────────────
function SuccessScreen({ mode, customerName, invoiceNumber, onDone }) {
  return (
    <div style={s.successWrap}>
      <div style={{ fontSize:64, marginBottom:16 }}>{mode === "sent" ? "📨" : "✅"}</div>
      <div style={{ fontSize:26, fontWeight:900, marginBottom:8 }}>
        {mode === "sent" ? "Estimate Sent!" : "Accepted!"}
      </div>
      <div style={{ fontSize:15, color:MUTED, lineHeight:1.5, marginBottom:16 }}>
        {mode === "sent"
          ? `${customerName} will get a text with an approval link.`
          : `Job and invoice created. Added to schedule queue.`}
      </div>
      {invoiceNumber && (
        <div style={{ fontSize:14, color:GOLD, fontWeight:700, marginBottom:24 }}>
          Invoice {invoiceNumber}
        </div>
      )}
      <button type="button" onClick={onDone} style={s.doneBtn}>
        View Schedule Queue →
      </button>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────
function EstimateBuilder({ lead = null, onDone, onCancel, apiBase }) {
  const [phase,        setPhase]        = useState("build");
  const [stumps,       setStumps]       = useState([newStump(0)]);
  const [customer,     setCustomer]     = useState({
    name: lead?.name||"", phone: lead?.phone||"",
    email: lead?.email||"", address: lead?.address||"",
  });
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState(null);
  const [estimate,     setEstimate]     = useState(null);
  const [photos,       setPhotos]       = useState([]);
  const [stumpPhotos,  setStumpPhotos]  = useState({});
  const [result,       setResult]       = useState(null);
  const [mode,         setMode]         = useState(null);
  const [showOnsite,   setShowOnsite]   = useState(false);
  const [showPicker,   setShowPicker]   = useState(false);

  const addStump    = () => setStumps(p => [...p, newStump(p.length)]);
  const removeStump = id  => setStumps(p => p.filter(s => s.id !== id));
  const updateStump = useCallback((id, f, v) =>
    setStumps(p => p.map(s => s.id === id ? { ...s, [f]: v } : s)), []);

  async function handleSave() {
    setError(null);
    if (!customer.name || !customer.phone) { setError("Name and phone required."); return; }
    if (stumps.some(s => !s.diameter || parseFloat(s.diameter) <= 0)) { setError("All stumps need a diameter."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/estimates`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          lead_id: lead?.id||null,
          customer_name: customer.name, customer_phone: customer.phone,
          customer_email: customer.email||null, address: customer.address||null,
          notes: notes||null,
          stumps: stumps.map(s => ({
            diameter_inches: parseFloat(s.diameter),
            difficulty: s.difficulty, access: s.access,
            height: s.height||"flush", cleanup: s.cleanup, roots: s.roots||"none",
            rocky: !!s.rocky, extra_deep: !!s.extra_deep,
            notes: s.notes||null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Save failed");
      setEstimate(data);
      setPhotos(data.photos || []);

      // Upload stump photos collected during the build phase
      const estimateId = data.id;
      const uploadPromises = stumps.map((stump, idx) => {
        const files = stumpPhotos[stump.id] || [];
        if (!files.length) return Promise.resolve();
        const formData = new FormData();
        files.forEach(f => formData.append("photos", f));
        return fetch(`${apiBase}/estimates/${estimateId}/photos?stump_number=${idx + 1}`, {
          method: "POST", body: formData,
        });
      });
      await Promise.all(uploadPromises);

      setPhase("saved");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleSend() {
    setSending(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/estimates/${estimate.id}/send`, { method:"POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMode("sent"); setResult(data); setPhase("success");
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }

  if (phase === "success") {
    return (
      <div style={s.root}>
        <SuccessScreen
          mode={mode} customerName={customer.name}
          invoiceNumber={result?.invoiceNumber}
          onDone={() => onDone?.(result)}
        />
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button type="button" onClick={onCancel} style={s.backBtn}>← Back</button>
        <h1 style={s.title}>{phase === "saved" ? "Estimate Ready" : "New Estimate"}</h1>
        <div style={s.headerAmt}>
          {fmt(phase === "saved" ? estimate?.total_amount ?? 0 : calcJob(stumps))}
        </div>
      </div>

      <div style={s.body}>

        {/* ══ BUILD ══════════════════════════════════════════════════════ */}
        {phase === "build" && (<>
          <section style={s.sec}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <h2 style={{ ...s.secHead, margin:0 }}>Customer</h2>
              <button type="button" onClick={() => setShowPicker(true)}
                style={{ background:"transparent", border:`1px solid ${GOLD}`, borderRadius:6, color:GOLD, fontSize:12, fontWeight:700, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                📋 Load Customer
              </button>
            </div>
            <input type="text" placeholder="Full Name *" value={customer.name}
              onChange={e => { const v = e.target.value; setCustomer(p => ({...p, name: v})); }}
              style={s.input} autoComplete="name" />
            <input type="tel" placeholder="Phone *" value={customer.phone}
              onChange={e => { const v = e.target.value; setCustomer(p => ({...p, phone: v})); }}
              style={s.input} autoComplete="tel" />
            <input type="email" placeholder="Email (optional)" value={customer.email}
              onChange={e => { const v = e.target.value; setCustomer(p => ({...p, email: v})); }}
              style={s.input} autoComplete="email" />
            <PlacesAutocomplete
              value={customer.address}
              onChange={v => setCustomer(p => ({...p, address: v}))}
              style={s.input}
              placeholder="Service Address"
            />
          </section>

          <section style={s.sec}>
            <h2 style={s.secHead}>
              Stumps <span style={s.cntBadge}>{stumps.length}</span>
            </h2>
            {stumps.map((st, i) => (
              <StumpCard key={st.id} stump={st} index={i}
                onChange={(f,v)=>updateStump(st.id,f,v)}
                onRemove={()=>removeStump(st.id)}
                canRemove={stumps.length>1}
                photos={stumpPhotos[st.id] || []}
                onPhotosChange={files => setStumpPhotos(p => ({ ...p, [st.id]: files }))}/>
            ))}
            <button type="button" onClick={addStump} style={s.addBtn}>+ Add Stump</button>
          </section>

          <section style={s.sec}>
            <h2 style={s.secHead}>Job Notes</h2>
            <textarea style={{...s.input,height:72,resize:"vertical"}}
              placeholder="Access notes, scheduling preferences, etc."
              value={notes} onChange={e=>setNotes(e.target.value)}/>
          </section>

          <Summary stumps={stumps}/>

          {error && <div style={s.errBox}>{error}</div>}

          <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{...s.saveBtn, opacity:saving?0.6:1}}>
              {saving?"Saving…":"Save Estimate"}
            </button>
            <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          </div>
        </>)}

        {/* ══ SAVED ══════════════════════════════════════════════════════ */}
        {phase === "saved" && estimate && (<>

          {/* Recap */}
          <div style={s.savedCard}>
            {[
              ["Customer", estimate.customer_name],
              ["Phone",    estimate.customer_phone],
              ...(estimate.address ? [["Address", estimate.address]] : []),
              ["Stumps",   estimate.stump_count],
            ].map(([label, val]) => (
              <div key={label} style={s.savedRow}>
                <span style={s.savedLbl}>{label}</span>
                <span style={s.savedVal}>{val}</span>
              </div>
            ))}
            <div style={{ ...s.savedRow, borderBottom:"none" }}>
              <span style={s.savedLbl}>Total</span>
              <span style={{ ...s.savedVal, color:GOLD, fontWeight:900, fontSize:22 }}>
                {fmt(estimate.total_amount)}
              </span>
            </div>
          </div>

          {/* Photos */}
          <section style={s.sec}>
            <h2 style={s.secHead}>
              Job Photos
              {photos.length > 0 && <span style={s.cntBadge}>{photos.length}</span>}
            </h2>
            <PhotoUpload
              estimateId={estimate.id}
              apiBase={apiBase}
              photos={photos}
              onPhotosChange={setPhotos}
            />
          </section>

          {/* Actions */}
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:MUTED,margin:"16px 0 12px" }}>
              What would you like to do?
            </div>

            <button type="button" onClick={handleSend} disabled={sending}
              style={{...s.actionBtn, background:"#0d2a45", border:"1px solid #1a4a70", opacity:sending?0.6:1}}>
              <span style={{ fontSize:24 }}>📱</span>
              <div>
                <div style={s.btnMain}>{sending?"Sending…":"Send to Customer"}</div>
                <div style={s.btnSub}>Text approval link to {estimate.customer_phone}</div>
              </div>
            </button>

            <button type="button" onClick={() => setShowOnsite(true)}
              style={{...s.actionBtn, background:"#0d2a1a", border:"1px solid #1a4a2a"}}>
              <span style={{ fontSize:24 }}>✍️</span>
              <div>
                <div style={s.btnMain}>Accept On-Site</div>
                <div style={s.btnSub}>Customer is present — capture signature &amp; convert now</div>
              </div>
            </button>

            <button type="button" onClick={() => onCancel?.()} style={s.laterBtn}>
              Save for Later
            </button>
          </div>

          {error && <div style={s.errBox}>{error}</div>}
        </>)}


      </div>

      {showPicker && (
        <CustomerPickerModal
          onSelect={lead => {
            setCustomer({
              name:    lead.name    || "",
              phone:   lead.phone   || "",
              email:   lead.email   || "",
              address: lead.address || "",
            });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showOnsite && (
        <OnsiteModal estimate={estimate} apiBase={apiBase}
          onSuccess={data => { setShowOnsite(false); setMode("onsite"); setResult(data); setPhase("success"); }}
          onClose={() => setShowOnsite(false)}/>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const GOLD = "#c4a43e"; const BG = "#111"; const CARD = "#1a1a1a";
const BORD = "#2a2a2a"; const TEXT = "#f0ece4"; const MUTED = "#777";

const s = {
  root:      { background:BG, minHeight:"100vh", color:TEXT, fontFamily:"'DM Sans',sans-serif", maxWidth:520, margin:"0 auto" },
  header:    { position:"sticky", top:0, zIndex:10, background:BG, borderBottom:`1px solid ${BORD}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 },
  backBtn:   { background:"none", border:"none", color:GOLD, fontSize:15, cursor:"pointer", fontFamily:"inherit" },
  title:     { flex:1, margin:0, fontSize:18, fontWeight:700 },
  headerAmt: { fontSize:20, fontWeight:900, color:GOLD },
  body:      { padding:"0 16px 100px" },
  sec:       { marginTop:24 },
  secHead:   { fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:MUTED, margin:"0 0 10px", display:"flex", alignItems:"center", gap:8 },
  cntBadge:  { background:GOLD, color:"#000", borderRadius:"50%", width:20, height:20, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900 },
  input:     { width:"100%", background:CARD, border:`1px solid ${BORD}`, borderRadius:8, color:TEXT, fontSize:15, padding:"12px 14px", marginBottom:8, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
  card:      { background:CARD, border:`1px solid ${BORD}`, borderRadius:12, padding:"14px 14px 10px", marginBottom:12 },
  cardHead:  { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  numBadge:  { background:GOLD, color:"#000", borderRadius:"50%", width:24, height:24, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900 },
  subAmt:    { fontSize:18, fontWeight:900, color:GOLD },
  minTag:    { fontSize:9, fontWeight:800, background:"#333", color:MUTED, borderRadius:4, padding:"2px 5px" },
  xBtn:      { background:"none", border:`1px solid ${BORD}`, borderRadius:6, color:MUTED, cursor:"pointer", padding:"2px 8px", fontSize:12, fontFamily:"inherit" },
  fieldLbl:  { fontSize:11, color:MUTED, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:6 },
  diamIn:    { background:"#222", border:`1px solid ${BORD}`, borderRadius:8, color:TEXT, fontSize:28, fontWeight:900, padding:"8px 14px", width:110, fontFamily:"inherit", outline:"none" },
  baseHint:  { fontSize:11, color:MUTED },
  segWrap:   { marginBottom:10 },
  segLbl:    { fontSize:11, color:MUTED, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:5 },
  segs:      { display:"flex", gap:4, flexWrap:"wrap" },
  seg:       { background:"#222", border:`1px solid ${BORD}`, borderRadius:6, color:MUTED, cursor:"pointer", fontSize:11, fontWeight:500, padding:"6px 10px", fontFamily:"inherit", whiteSpace:"nowrap" },
  segOn:     { background:GOLD, borderColor:GOLD, color:"#000", fontWeight:800 },
  badge:     { fontSize:9, opacity:0.75 },
  notesIn:   { width:"100%", background:"#1e1e1e", border:`1px solid ${BORD}`, borderRadius:6, color:MUTED, fontSize:12, padding:"8px 10px", marginTop:6, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
  addBtn:    { width:"100%", background:"transparent", border:`2px dashed ${BORD}`, borderRadius:10, color:GOLD, cursor:"pointer", fontSize:14, fontWeight:700, padding:14, fontFamily:"inherit", marginTop:4 },
  summCard:  { background:"#161616", border:`1px solid ${GOLD}33`, borderRadius:12, padding:16, marginTop:24 },
  summTitle: { fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:MUTED, marginBottom:12 },
  summRow:   { display:"flex", justifyContent:"space-between", gap:8, marginBottom:8, fontSize:13 },
  summItem:  { color:MUTED, flex:1, lineHeight:1.4 },
  summAmt:   { fontWeight:700, color:TEXT },
  divider:   { borderTop:`1px solid ${BORD}`, margin:"10px 0" },
  totalRow:  { display:"flex", justifyContent:"space-between", fontSize:22, fontWeight:900, color:GOLD },
  errBox:    { background:"#2a1111", border:"1px solid #5a2020", borderRadius:8, color:"#f87171", fontSize:13, padding:"12px 14px", marginTop:16 },
  saveBtn:   { background:"#2e7d32", border:"none", borderRadius:10, color:"#fff", cursor:"pointer", fontSize:16, fontWeight:800, padding:16, fontFamily:"inherit" },
  cancelBtn: { background:"transparent", border:`1px solid ${BORD}`, borderRadius:10, color:MUTED, cursor:"pointer", fontSize:14, padding:12, fontFamily:"inherit" },
  savedCard: { background:CARD, border:`1px solid ${BORD}`, borderRadius:12, padding:"4px 16px", marginTop:20 },
  savedRow:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${BORD}` },
  savedLbl:  { fontSize:12, color:MUTED, fontWeight:600 },
  savedVal:  { fontSize:14, fontWeight:600 },
  // photos
  dropZone:  { border:`2px dashed ${BORD}`, borderRadius:10, padding:"24px 16px", textAlign:"center", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 },
  dropIcon:  { fontSize:32 },
  dropLabel: { fontSize:14, fontWeight:700, color:TEXT },
  dropSub:   { fontSize:12, color:MUTED },
  photoGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 },
  photoItem: { display:"flex", flexDirection:"column", gap:4 },
  photoImgWrap: { position:"relative" },
  photoImg:  { width:"100%", aspectRatio:"4/3", objectFit:"cover", borderRadius:8, display:"block" },
  photoRemove: { position:"absolute", top:4, right:4, background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", borderRadius:"50%", width:22, height:22, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" },
  captionRow: { display:"flex", gap:4, flexWrap:"wrap" },
  captionChip: { background:"#222", border:`1px solid ${BORD}`, borderRadius:20, color:MUTED, cursor:"pointer", fontSize:10, fontWeight:600, padding:"3px 8px", fontFamily:"inherit" },
  captionChipOn: { background:GOLD, borderColor:GOLD, color:"#000" },
  // action buttons
  actionBtn: { width:"100%", borderRadius:12, color:TEXT, cursor:"pointer", fontSize:14, fontFamily:"inherit", padding:"16px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:14, textAlign:"left" },
  btnMain:   { fontWeight:800, fontSize:15 },
  btnSub:    { fontSize:12, color:MUTED, marginTop:2 },
  laterBtn:  { width:"100%", background:"transparent", border:`1px solid ${BORD}`, borderRadius:10, color:MUTED, cursor:"pointer", fontSize:14, padding:12, fontFamily:"inherit" },
  // modal
  overlay:   { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, display:"flex", alignItems:"flex-end" },
  modal:     { background:"#1a1a1a", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:520, margin:"0 auto", paddingBottom:20 },
  modalHead: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px 12px", borderBottom:`1px solid ${BORD}` },
  modalClose:{ background:"none", border:"none", color:MUTED, fontSize:20, cursor:"pointer" },
  confirmBtn:{ width:"100%", background:"#2e7d32", border:"none", borderRadius:10, color:"#fff", cursor:"pointer", fontSize:16, fontWeight:800, padding:16, fontFamily:"inherit" },
  // signature
  sigLbl:    { fontSize:11, color:MUTED, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:8 },
  sigWrap:   { position:"relative", background:"#111", borderRadius:10, border:`1px solid ${BORD}`, overflow:"hidden" },
  sigCanvas: { display:"block", width:"100%", touchAction:"none" },
  sigHint:   { position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", fontSize:11, color:"#333", pointerEvents:"none" },
  clearBtn:  { background:"none", border:"none", color:MUTED, fontSize:12, cursor:"pointer", padding:"4px 0", fontFamily:"inherit" },
  // success
  successWrap: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"80vh", padding:32, textAlign:"center" },
  doneBtn:   { background:GOLD, border:"none", borderRadius:10, color:"#000", cursor:"pointer", fontSize:16, fontWeight:800, padding:"14px 28px", fontFamily:"inherit" },
};



// ============================================================
// NEW INVOICE FORM
// ============================================================
function NewInvoiceScreen({ onBack, onSave, jobs, initialData }) {
  const fromEstimate = initialData?.fromEstimate;
  const [selectedJobId, setSelectedJobId] = useState("");
  const [form, setForm] = useState({
    customer_name: fromEstimate?.customer_name || "",
    phone: fromEstimate?.phone || "",
    email: fromEstimate?.email || "",
    address: fromEstimate?.address || "",
    estimate_id: fromEstimate?.id || null,
    tax_pct: "0",
    notes: "",
  });
  const [lineItems, setLineItems] = useState(
    fromEstimate
      ? [{ description: fromEstimate.description || "Stump removal services", quantity: "1", unit_price: String(fromEstimate.amount || "") }]
      : [{ description: "", quantity: "1", unit_price: "" }]
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleJobSelect = (jobId) => {
    setSelectedJobId(jobId);
    if (!jobId) return;
    const job = jobs.find(j => j.id === parseInt(jobId));
    if (job) {
      set("customer_name", job.customer_name || "");
      set("phone", job.phone || "");
      set("email", job.email || "");
      set("address", job.address || "");
      set("job_id", job.id);
      if (!lineItems[0].description) {
        setLineItems([{ description: job.notes || "Stump removal services", quantity: "1", unit_price: String(job.amount || "") }]);
      }
    }
  };

  const addLine = () => setLineItems(prev => [...prev, { description: "", quantity: "1", unit_price: "" }]);
  const removeLine = (i) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i, key, val) => setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 1), 0);
  const taxAmt = subtotal * (parseFloat(form.tax_pct) || 0) / 100;
  const total = subtotal + taxAmt;

  const handleSave = async (syncToQb) => {
    if (!form.customer_name) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, line_items: lineItems, sync_to_qb: syncToQb, tax_pct: parseFloat(form.tax_pct) || 0 }),
      });
      const inv = await res.json();
      onSave(inv);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
      <SectionHeader title="New Invoice" />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>

        {!fromEstimate && (
          <div>
            <label style={labelStyle}>Pre-fill from Job</label>
            <select style={inputStyle} value={selectedJobId} onChange={e => handleJobSelect(e.target.value)}>
              <option value="">— Select a job or enter manually —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.customer_name}{j.address ? ` · ${j.address}` : ""}</option>)}
            </select>
          </div>
        )}

        <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="Customer name" /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="304-555-0000" /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, Charleston, WV" /></div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Line Items</label>
            <button onClick={addLine} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.accent, borderRadius: "4px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>+ Add</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lineItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                <input style={{ ...inputStyle, flex: 3 }} value={item.description} onChange={e => updateLine(i, "description", e.target.value)} placeholder="Description" />
                <input style={{ ...inputStyle, flex: 1, textAlign: "center" }} type="number" min="1" value={item.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} placeholder="Qty" />
                <input style={{ ...inputStyle, flex: 1.5 }} type="number" step="0.01" value={item.unit_price} onChange={e => updateLine(i, "unit_price", e.target.value)} placeholder="Price" />
                {lineItems.length > 1 && (
                  <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: "18px", padding: "8px 4px", flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px", alignItems: "center" }}>
          <div><label style={labelStyle}>Tax %</label><input style={inputStyle} type="number" min="0" max="100" step="0.1" value={form.tax_pct} onChange={e => set("tax_pct", e.target.value)} placeholder="0" /></div>
          <div style={{ background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, padding: "12px 14px", marginTop: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: COLORS.textMuted, marginBottom: "3px" }}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {taxAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: COLORS.textMuted, marginBottom: "3px" }}><span>Tax</span><span>{formatCurrency(taxAmt)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 800, color: COLORS.accent }}><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes for the invoice..." /></div>
      </div>

      <button onClick={() => handleSave(true)} disabled={saving || !form.customer_name} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800, cursor: "pointer", marginBottom: "10px", opacity: saving || !form.customer_name ? 0.6 : 1 }}>
        {saving ? "Saving..." : "Create & Sync to QuickBooks"}
      </button>
      <button onClick={() => handleSave(false)} disabled={saving || !form.customer_name} style={{ width: "100%", padding: "13px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textMuted, fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: saving || !form.customer_name ? 0.6 : 1 }}>
        {saving ? "Saving..." : "Save as Draft"}
      </button>
    </div>
  );
}

// ============================================================
// SCREENS
// ============================================================
function DashboardScreen({ leads, jobs, estimates, invoices, onNavigate }) {
  const newLeads = leads.filter(l => l.status === "new").length;
  const todayJobs = jobs.filter(j => j.scheduled_date === new Date().toISOString().split("T")[0]);
  const revenue = invoices.filter(j => j.status === "paid").reduce((sum, j) => sum + (parseFloat(j.total) || 0), 0)
    + jobs.filter(j => j.status === "paid" || j.status === "invoiced").reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);
  const pendingEstimates = estimates.filter(e => e.status === "pending").length;

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 900, color: COLORS.text, margin: 0, letterSpacing: "-1px" }}>
          Stump Pros<span style={{ color: COLORS.accent }}> WV</span>
        </h1>
        <div style={{ fontSize: "13px", color: COLORS.textMuted, marginTop: "2px" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
        <Card>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>New Leads</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: newLeads > 0 ? COLORS.accent : COLORS.textMuted, letterSpacing: "-1px" }}>{newLeads}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Today's Jobs</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: todayJobs.length > 0 ? COLORS.blue : COLORS.textMuted, letterSpacing: "-1px" }}>{todayJobs.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Revenue</div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: COLORS.green, letterSpacing: "-1px" }}>{formatCurrency(revenue)}</div>
        </Card>
        <Card onClick={pendingEstimates > 0 ? () => onNavigate("billing") : undefined}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Pending Quotes</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: pendingEstimates > 0 ? COLORS.accent : COLORS.textMuted, letterSpacing: "-1px" }}>{pendingEstimates}</div>
        </Card>
      </div>

      {/* Quick action */}
      <button onClick={() => onNavigate("new-estimate")} style={{
        width: "100%", padding: "14px 16px", borderRadius: "10px",
        border: `2px solid ${COLORS.accent}40`, background: `${COLORS.accent}10`,
        color: COLORS.accent, fontSize: "15px", fontWeight: 800, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        marginBottom: "24px", fontFamily: "inherit",
      }}>
        📋 New Estimate
      </button>

      <SectionHeader title="Recent Leads" count={leads.length}
        action={<button onClick={() => onNavigate("leads")} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>View all →</button>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {leads.slice(0, 3).map(l => (
          <LeadCard key={l.id} lead={l} onClick={() => onNavigate("lead-detail", l)} />
        ))}
        {leads.length === 0 && <EmptyState icon="📭" title="No leads yet" subtitle="They'll show up here automatically" />}
      </div>

      <SectionHeader title="Upcoming Jobs" count={jobs.filter(j => j.status === "scheduled").length}
        action={<button onClick={() => onNavigate("jobs")} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>View all →</button>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {jobs.filter(j => j.status === "scheduled").slice(0, 3).map(j => (
          <JobCard key={j.id} job={j} onClick={() => onNavigate("job-detail", j)} />
        ))}
        {jobs.filter(j => j.status === "scheduled").length === 0 && <EmptyState icon="📋" title="No upcoming jobs" subtitle="Convert leads or create jobs to fill the schedule" />}
      </div>
    </div>
  );
}

function LeadsScreen({ leads, onNavigate }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);

  return (
    <div>
      <SectionHeader title="Leads" count={leads.length}
        action={<button onClick={() => onNavigate("new-lead")} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ New Lead</button>}
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
        {["all", "new", "contacted", "quoted", "converted", "lost"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: "20px", border: `1px solid ${filter === f ? COLORS.accent + "60" : COLORS.border}`,
            background: filter === f ? COLORS.accentDim + "40" : "transparent",
            color: filter === f ? COLORS.accent : COLORS.textMuted,
            cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s",
          }}>
            {f === "all" ? "All" : STATUS_CONFIG[f].label}
            {f === "new" && <span style={{ marginLeft: "4px", color: COLORS.accent }}>{leads.filter(l => l.status === "new").length}</span>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(l => (
          <LeadCard key={l.id} lead={l} onClick={() => onNavigate("lead-detail", l)} />
        ))}
        {filtered.length === 0 && <EmptyState icon="🔍" title="No leads found" subtitle={`No ${filter} leads to show`} />}
      </div>
    </div>
  );
}

function JobsScreen({ jobs, onNavigate }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

  return (
    <div>
      <SectionHeader title="Jobs" count={jobs.length}
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => onNavigate("new-estimate")} style={{ padding: "6px 14px", borderRadius: "6px", border: `1px solid ${COLORS.accent}`, background: "transparent", color: COLORS.accent, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>📋 New Estimate</button>
            <button onClick={() => onNavigate("new-job")} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ New Job</button>
          </div>
        }
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
        {["all", "estimate", "scheduled", "in_progress", "completed", "invoiced", "paid"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: "20px", border: `1px solid ${filter === f ? COLORS.accent + "60" : COLORS.border}`,
            background: filter === f ? COLORS.accentDim + "40" : "transparent",
            color: filter === f ? COLORS.accent : COLORS.textMuted,
            cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s",
          }}>
            {f === "all" ? "All" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(j => (
          <JobCard key={j.id} job={j} onClick={() => onNavigate("job-detail", j)} />
        ))}
        {filtered.length === 0 && <EmptyState icon="🪵" title="No jobs found" subtitle={`No ${filter} jobs to show`} />}
      </div>
    </div>
  );
}

// ============================================================
// BILLING SCREEN (Quotes + Invoices)
// ============================================================
function BillingScreen({ estimates, invoices, onNavigate }) {
  const [subTab, setSubTab] = useState("quotes");

  const pillStyle = (active) => ({
    flex: 1, padding: "8px", borderRadius: "6px", border: "none", cursor: "pointer",
    fontSize: "13px", fontWeight: 700, transition: "all 0.15s",
    background: active ? COLORS.accent : "transparent",
    color: active ? COLORS.bg : COLORS.textMuted,
  });

  return (
    <div>
      <SectionHeader title="Billing" />

      {/* Sub-tab pill selector */}
      <div style={{ display: "flex", gap: "4px", background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`, padding: "4px", marginBottom: "16px" }}>
        <button style={pillStyle(subTab === "quotes")} onClick={() => setSubTab("quotes")}>
          📋 Quotes {estimates.filter(e => e.status === "pending").length > 0 && <span style={{ background: COLORS.red, color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", marginLeft: "4px" }}>{estimates.filter(e => e.status === "pending").length}</span>}
        </button>
        <button style={pillStyle(subTab === "invoices")} onClick={() => setSubTab("invoices")}>
          🧾 Invoices
        </button>
      </div>

      {subTab === "quotes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button onClick={() => onNavigate("new-estimate")} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ New Quote</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {estimates.map(e => (
              <EstimateCard key={e.id} estimate={e} onClick={() => onNavigate("estimate-detail", e)} />
            ))}
            {estimates.length === 0 && <EmptyState icon="📋" title="No quotes yet" subtitle="Send an estimate to a customer to get started" />}
          </div>
        </div>
      )}

      {subTab === "invoices" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button onClick={() => onNavigate("new-invoice")} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ New Invoice</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {invoices.map(inv => (
              <InvoiceCard key={inv.id} invoice={inv} onClick={() => onNavigate("invoice-detail", inv)} />
            ))}
            {invoices.length === 0 && <EmptyState icon="🧾" title="No invoices yet" subtitle="Create an invoice or convert an approved quote" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function SettingsScreen() {
  const [autoText, setAutoText] = useState("Hi {name}, thank you for reaching out to Stump Pros WV! We've received your message and will be in touch with you shortly.");
  const [reviewDelay, setReviewDelay] = useState("24");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [facebookReviewUrl, setFacebookReviewUrl] = useState("");
  const [estimateDiscountPct, setEstimateDiscountPct] = useState("10");
  const [estimateIntroMsg, setEstimateIntroMsg] = useState("Hi {name}, here is your estimate from Stump Pros WV:");
  const [estimateDiscountMsg, setEstimateDiscountMsg] = useState("We'd still love to earn your business! Here's a special discounted offer just for you:");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings`).then(r => r.json()).then(s => {
      if (s.auto_text) setAutoText(s.auto_text);
      if (s.review_delay) setReviewDelay(String(s.review_delay));
      if (s.google_review_url) setGoogleReviewUrl(s.google_review_url);
      if (s.facebook_review_url) setFacebookReviewUrl(s.facebook_review_url);
      if (s.estimate_discount_pct != null) setEstimateDiscountPct(String(s.estimate_discount_pct));
      if (s.estimate_intro_msg) setEstimateIntroMsg(s.estimate_intro_msg);
      if (s.estimate_discount_msg) setEstimateDiscountMsg(s.estimate_discount_msg);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    await fetch(`${API_BASE}/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auto_text: autoText,
        review_delay: parseInt(reviewDelay),
        google_review_url: googleReviewUrl,
        facebook_review_url: facebookReviewUrl,
        estimate_discount_pct: parseInt(estimateDiscountPct),
        estimate_intro_msg: estimateIntroMsg,
        estimate_discount_msg: estimateDiscountMsg,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "13px", padding: "8px 10px", boxSizing: "border-box" };

  return (
    <div>
      <SectionHeader title="Settings" />

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Auto-Response Text Message</div>
        <textarea value={autoText} onChange={e => setAutoText(e.target.value)} rows={4} style={{
          width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px",
          color: COLORS.text, fontSize: "13px", padding: "10px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
          boxSizing: "border-box",
        }} />
        <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px" }}>Use {"{name}"} for the customer's name</div>
      </Card>

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Review Request Delay</div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input type="number" value={reviewDelay} onChange={e => setReviewDelay(e.target.value)} style={{
            width: "60px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px",
            color: COLORS.text, fontSize: "14px", padding: "8px 10px", textAlign: "center",
          }} />
          <span style={{ fontSize: "13px", color: COLORS.textMuted }}>hours after job completion</span>
        </div>
      </Card>

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Review Links</div>
        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Google Business Profile Review URL</label>
          <input type="url" value={googleReviewUrl} onChange={e => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/..." style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Facebook Review URL</label>
          <input type="url" value={facebookReviewUrl} onChange={e => setFacebookReviewUrl(e.target.value)} placeholder="https://facebook.com/stumpproswv/reviews" style={inputStyle} />
        </div>
      </Card>

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Estimate Settings</div>
        <div style={{ marginBottom: "12px" }}>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Auto-Discount % (offered on decline)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="number" min="0" max="50" value={estimateDiscountPct} onChange={e => setEstimateDiscountPct(e.target.value)} style={{ ...inputStyle, width: "70px", textAlign: "center" }} />
            <span style={{ fontSize: "13px", color: COLORS.textMuted }}>%</span>
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Estimate Intro Message <span style={{ color: COLORS.textDim }}>(use {"{name}"})</span></label>
          <input type="text" value={estimateIntroMsg} onChange={e => setEstimateIntroMsg(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Discount Offer Message</label>
          <input type="text" value={estimateDiscountMsg} onChange={e => setEstimateDiscountMsg(e.target.value)} style={inputStyle} />
        </div>
      </Card>

      <Card style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Quo Integration</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.accent, display: "inline-block" }}></span>
          <span style={{ fontSize: "13px", color: COLORS.textMuted }}>Waiting for number port (304-712-2005)</span>
        </div>
      </Card>

      <button onClick={handleSave} style={{
        width: "100%", padding: "14px", borderRadius: "8px", border: "none",
        background: saved ? COLORS.green : COLORS.accent, color: saved ? "#fff" : COLORS.bg,
        fontSize: "14px", fontWeight: 800, cursor: "pointer", transition: "background 0.2s",
      }}>
        {saved ? "✓ Saved" : "Save Settings"}
      </button>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// ============================================================
// CUSTOMER SELECTOR — search-as-you-type autocomplete
// ============================================================
function CustomerSelector({ onSelect, initialName = "", placeholder = "Search existing customers..." }) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = React.useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch (e) { /* silent */ } finally { setSearching(false); }
  };

  const handleChange = (v) => {
    setQuery(v);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => doSearch(v), 250);
  };

  const handleSelect = (c) => {
    setQuery(c.name);
    setOpen(false);
    setResults([]);
    onSelect(c);
  };

  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          style={{ ...inputStyle, paddingRight: "32px" }}
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => query && doSearch(query)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
        />
        {searching && <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: COLORS.textMuted }}>⌛</span>}
        {!searching && query && <span onClick={() => { setQuery(""); setResults([]); onSelect(null); }} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: COLORS.textMuted, cursor: "pointer" }}>✕</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", marginTop: "4px" }}>
          {results.map(c => (
            <div key={c.id} onMouseDown={() => handleSelect(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: COLORS.text }}>{c.name}</div>
              <div style={{ fontSize: "12px", color: COLORS.textMuted }}>{[c.phone, c.address].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// (PhotoUpload is defined in the EstimateBuilder section above)

// ============================================================
// CUSTOMERS SCREEN
// ============================================================
function CustomersScreen({ onNavigate }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = React.useRef(null);
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };

  const load = async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `${API_BASE}/customers?search=${encodeURIComponent(q)}&limit=200` : `${API_BASE}/customers?limit=200`;
      const res = await fetch(url);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) { setCustomers([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(window._custSearchTimeout);
    window._custSearchTimeout = setTimeout(() => load(v), 300);
  };

  const importQB = async () => {
    setImporting("qb"); setImportResult(null);
    try {
      const res = await fetch(`${API_BASE}/customers/import/quickbooks`, { method: "POST" });
      const data = await res.json();
      if (data.error) { setImportResult({ error: data.error }); }
      else { setImportResult({ msg: `✅ Imported ${data.imported} new, updated ${data.updated}` }); load(search); }
    } catch (e) { setImportResult({ error: e.message }); } finally { setImporting(null); }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      vals.push(cur.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
      return obj;
    });
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting("csv"); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rows = parseCSV(ev.target.result);
      try {
        const res = await fetch(`${API_BASE}/customers/import/csv`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const data = await res.json();
        if (data.error) { setImportResult({ error: data.error }); }
        else { setImportResult({ msg: `✅ Imported ${data.imported} new, skipped ${data.skipped} duplicates` }); load(search); }
      } catch (err) { setImportResult({ error: err.message }); } finally { setImporting(null); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sourceLabel = (s) => s === "quickbooks" ? "QB" : s === "housecall_pro" ? "HCP" : "";
  const sourceBg = (s) => s === "quickbooks" ? "#1a3a1a" : s === "housecall_pro" ? "#1a2a3a" : null;
  const sourceColor = (s) => s === "quickbooks" ? "#4ade80" : s === "housecall_pro" ? "#60a5fa" : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <SectionHeader title={`Customers (${customers.length})`} />
        <button onClick={() => onNavigate("add-customer")} style={{ background: COLORS.accent, border: "none", borderRadius: "8px", color: COLORS.bg, fontSize: "13px", fontWeight: 700, padding: "8px 14px", cursor: "pointer" }}>+ Add</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "14px" }}>
        <input style={inputStyle} value={search} onChange={e => handleSearch(e.target.value)} placeholder="🔍  Search by name, phone, or email..." />
      </div>

      {/* Import buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <button onClick={importQB} disabled={!!importing} style={{ flex: 1, padding: "9px 10px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", color: COLORS.text, fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: importing ? 0.6 : 1 }}>
          {importing === "qb" ? "Importing..." : "⬇ Import from QuickBooks"}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={!!importing} style={{ flex: 1, padding: "9px 10px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", color: COLORS.text, fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: importing ? 0.6 : 1 }}>
          {importing === "csv" ? "Importing..." : "⬇ Import HCP CSV"}
        </button>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
      </div>

      {importResult && (
        <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "8px", background: importResult.error ? "#2a1a1a" : "#1a2a1a", border: `1px solid ${importResult.error ? COLORS.red : "#4ade80"}40`, fontSize: "13px", color: importResult.error ? COLORS.red : "#4ade80" }}>
          {importResult.error || importResult.msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: "14px", padding: "40px 0" }}>Loading...</div>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: "14px", padding: "40px 0" }}>
          {search ? "No customers match your search." : "No customers yet. Import from QuickBooks or Housecall Pro, or add manually."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {customers.map(c => (
            <div key={c.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onNavigate("customer-detail", c)}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: "8px" }}>
                  {c.name}
                  {c.source !== "manual" && <span style={{ fontSize: "10px", fontWeight: 700, background: sourceBg(c.source), color: sourceColor(c.source), padding: "2px 6px", borderRadius: "4px" }}>{sourceLabel(c.source)}</span>}
                </div>
                {c.phone && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>📞 {c.phone}</div>}
                {c.address && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {c.address}</div>}
              </div>
              <button onClick={e => { e.stopPropagation(); onNavigate("add-customer", c); }}
                style={{ marginLeft: 10, background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textMuted, fontSize: 12, padding: "5px 10px", cursor: "pointer", flexShrink: 0 }}>
                ✏️ Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CUSTOMER DETAIL
// ============================================================
function CustomerDetail({ customer, onBack, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm(`Delete ${customer.name}?`)) return;
    setDeleting(true);
    await fetch(`${API_BASE}/customers/${customer.id}`, { method: "DELETE" });
    onDelete();
  };
  const Row = ({ icon, val }) => val ? <div style={{ fontSize: "13px", color: COLORS.text, display: "flex", gap: "8px", alignItems: "flex-start" }}><span>{icon}</span><span>{val}</span></div> : null;
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px" }}>← Customers</button>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: COLORS.text, margin: 0 }}>{customer.name}</h2>
        <button onClick={onEdit} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.textMuted, fontSize: "12px", padding: "6px 12px", cursor: "pointer" }}>Edit</button>
      </div>
      <Card style={{ gap: "10px", display: "flex", flexDirection: "column", marginBottom: "12px" }}>
        <Row icon="📞" val={customer.phone} />
        <Row icon="✉️" val={customer.email} />
        <Row icon="📍" val={customer.address} />
        {customer.notes && <Row icon="📝" val={customer.notes} />}
      </Card>
      <button onClick={handleDelete} disabled={deleting} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${COLORS.red}40`, background: "transparent", color: COLORS.red, fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
        {deleting ? "Deleting..." : "Delete Customer"}
      </button>
    </div>
  );
}

// ============================================================
// ADD / EDIT CUSTOMER FORM
// ============================================================
function AddCustomerScreen({ onBack, onSave, existing = null }) {
  const [form, setForm] = useState({ name: existing?.name || "", phone: existing?.phone || "", email: existing?.email || "", address: existing?.address || "", notes: existing?.notes || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const url = existing ? `${API_BASE}/customers/${existing.id}` : `${API_BASE}/customers`;
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const customer = await res.json();
      onSave(customer);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px" }}>← Back</button>
      <SectionHeader title={existing ? "Edit Customer" : "Add Customer"} />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
        <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name" /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="304-555-0000" /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><label style={labelStyle}>Address</label>
          <PlacesAutocomplete value={form.address} onChange={v => set("address", v)} style={inputStyle} placeholder="123 Main St, City, WV" />
        </div>
        <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any notes..." /></div>
      </div>
      <button onClick={handleSave} disabled={saving || !form.name} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800, cursor: "pointer", opacity: saving || !form.name ? 0.6 : 1 }}>
        {saving ? "Saving..." : existing ? "Save Changes" : "Add Customer"}
      </button>
    </div>
  );
}

// ============================================================
// APP COMPONENT
// ============================================================
function StumpProsApp() {
  const [screen, setScreen] = useState("dashboard");
  const [selectedItem, setSelectedItem] = useState(null);
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const navigate = useCallback((target, item = null) => {
    setScreen(target);
    setSelectedItem(item);
  }, []);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const [leadsRes, jobsRes, estimatesRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE}/leads`, { signal: controller.signal }),
        fetch(`${API_BASE}/jobs`, { signal: controller.signal }),
        fetch(`${API_BASE}/estimates`, { signal: controller.signal }),
        fetch(`${API_BASE}/invoices`, { signal: controller.signal }),
      ]);
      clearTimeout(timer);
      if (!leadsRes.ok || !jobsRes.ok) throw new Error(`Server error`);
      const [leadsData, jobsData, estimatesData, invoicesData] = await Promise.all([
        leadsRes.json(), jobsRes.json(), estimatesRes.json(), invoicesRes.json(),
      ]);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setEstimates(Array.isArray(estimatesData) ? estimatesData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (err) {
      console.error("Load error:", err);
      setLoadError(err.name === "AbortError" ? "Server took too long to respond. Tap retry." : "Couldn't connect to server. Tap retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateLeadStatus = async (id, newStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    await fetch(`${API_BASE}/leads/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const updateJobStatus = async (id, newStatus) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
    await fetch(`${API_BASE}/jobs/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const updateInvoiceStatus = async (id, newStatus) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
    await fetch(`${API_BASE}/invoices/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const convertLead = async (lead) => {
    const res = await fetch(`${API_BASE}/leads/${lead.id}/convert`, { method: "POST" });
    const newJob = await res.json();
    await loadData();
    navigate("job-detail", newJob);
  };

  const newLeadCount = leads.filter(l => l.status === "new").length;
  const pendingEstimateCount = estimates.filter(e => e.status === "pending").length;

  const activeTab = screen === "dashboard" ? "dashboard"
    : screen.includes("lead") ? "leads"
    : screen.includes("job") ? "jobs"
    : (screen.includes("estimate") || screen.includes("invoice") || screen === "billing") ? "billing"
    : screen.includes("customer") ? "customers"
    : screen;

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <DashboardScreen leads={leads} jobs={jobs} estimates={estimates} invoices={invoices} onNavigate={navigate} />;
      case "leads":
        return <LeadsScreen leads={leads} onNavigate={navigate} />;
      case "new-lead":
        return <NewLeadScreen onBack={() => navigate("leads")} onSave={(lead) => { loadData(); navigate("lead-detail", lead); }} />;
      case "lead-detail":
        return selectedItem ? <LeadDetail lead={selectedItem} onBack={() => navigate("leads")} onConvert={convertLead} onUpdateStatus={updateLeadStatus} /> : null;
      case "jobs":
        return <JobsScreen jobs={jobs} onNavigate={navigate} />;
      case "new-job":
        return <NewJobScreen onBack={() => navigate("jobs")} onSave={(job) => { loadData(); navigate("job-detail", job); }} />;
      case "job-detail":
        return selectedItem ? (
          <JobDetail
            job={selectedItem}
            onBack={() => navigate("jobs")}
            onUpdateStatus={updateJobStatus}
            onSendEstimate={(job) => navigate("new-estimate", job)}
            onRefresh={loadData}
          />
        ) : null;
      case "billing":
        return <BillingScreen estimates={estimates} invoices={invoices} onNavigate={navigate} />;
      case "new-estimate":
        return (
          <EstimateBuilder
            lead={selectedItem ? {
              id: selectedItem.lead_id || null,
              name: selectedItem.customer_name || "",
              phone: selectedItem.phone || "",
              email: selectedItem.email || "",
              address: selectedItem.address || "",
            } : null}
            onDone={() => { loadData(); navigate("billing"); }}
            onCancel={() => navigate("billing")}
            apiBase={API_BASE}
          />
        );
      case "estimate-detail":
        return selectedItem ? (
          <EstimateDetail
            estimate={selectedItem}
            onBack={() => navigate("billing")}
            onCreateInvoice={(est) => navigate("new-invoice", { fromEstimate: est })}
            onRefresh={loadData}
          />
        ) : null;
      case "new-invoice":
        return (
          <NewInvoiceScreen
            onBack={() => navigate("billing")}
            onSave={() => { loadData(); navigate("billing"); }}
            jobs={jobs}
            initialData={selectedItem}
          />
        );
      case "invoice-detail":
        return selectedItem ? (
          <InvoiceDetail
            invoice={selectedItem}
            onBack={() => navigate("billing")}
            onUpdateStatus={updateInvoiceStatus}
          />
        ) : null;
      case "customers":
        return <CustomersScreen onNavigate={navigate} />;
      case "customer-detail":
        return selectedItem ? (
          <CustomerDetail
            customer={selectedItem}
            onBack={() => navigate("customers")}
            onEdit={() => navigate("add-customer", selectedItem)}
            onDelete={() => { navigate("customers"); }}
          />
        ) : null;
      case "add-customer":
        return (
          <AddCustomerScreen
            onBack={() => navigate(selectedItem ? "customer-detail" : "customers")}
            onSave={() => { navigate("customers"); }}
            existing={selectedItem}
          />
        );
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen leads={leads} jobs={jobs} estimates={estimates} invoices={invoices} onNavigate={navigate} />;
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.textMuted, fontSize: "14px" }}>Loading...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px" }}>
        <div style={{ color: COLORS.red, fontSize: "15px", textAlign: "center" }}>{loadError}</div>
        <button onClick={() => { setLoading(true); loadData(); }}
          style={{ background: COLORS.accent, color: "#000", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      maxWidth: "480px", margin: "0 auto", position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ flex: 1, padding: "calc(20px + env(safe-area-inset-top)) 16px 100px 16px", overflowY: "auto" }}>
        {renderScreen()}
      </div>

      <div className="app-tab-bar" style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: "480px",
        background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-around",
        zIndex: 100,
      }}>
        <IconButton icon="🏠" label="Home" active={activeTab === "dashboard"} onClick={() => navigate("dashboard")} />
        <IconButton icon="📋" label="Leads" active={activeTab === "leads"} onClick={() => navigate("leads")} badge={newLeadCount} />
        <IconButton icon="🪵" label="Jobs" active={activeTab === "jobs"} onClick={() => navigate("jobs")} />
        <IconButton icon="💳" label="Billing" active={activeTab === "billing"} onClick={() => navigate("billing")} badge={pendingEstimateCount} />
        <IconButton icon="👥" label="Customers" active={activeTab === "customers"} onClick={() => navigate("customers")} />
        <IconButton icon="⚙️" label="Settings" active={activeTab === "settings"} onClick={() => navigate("settings")} />
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(StumpProsApp));
