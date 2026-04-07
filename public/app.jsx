const { useState, useEffect, useCallback } = React;

// ============================================================
// STUMP PROS WV - FIELD SERVICE APP
// ============================================================

const API_BASE = "https://stump-pros-backend-production.up.railway.app/api";

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
  const statusColor = {
    pending: COLORS.accent,
    approved: COLORS.green,
    declined: COLORS.red,
    discount_offered: COLORS.blue,
    discount_approved: COLORS.green,
    expired: COLORS.textMuted,
  }[estimate.status] || COLORS.textMuted;

  return (
    <Card onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text }}>{estimate.customer_name}</div>
          {estimate.address && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>📍 {estimate.address}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <StatusBadge status={estimate.status} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: COLORS.accent }}>{formatCurrency(estimate.amount)}</span>
        </div>
      </div>
      {estimate.description && (
        <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {estimate.description}
        </div>
      )}
      <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px" }}>
        {estimate.sent_at ? `Sent ${timeAgo(estimate.sent_at)}` : `Created ${timeAgo(estimate.created_at)}`}
      </div>
    </Card>
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
// JOB DETAIL VIEW
// ============================================================
function JobDetail({ job, onBack, onUpdateStatus, onSendEstimate }) {
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
// NEW ESTIMATE FORM
// ============================================================
function NewEstimateScreen({ onBack, onSave, initialData }) {
  const [form, setForm] = useState({
    customer_name: initialData?.customer_name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    description: initialData?.notes || "",
    amount: "",
    notes: "",
    job_id: initialData?.id || null,
  });
  const [photos, setPhotos] = useState([]);
  const [customerId, setCustomerId] = useState(initialData?.customer_id || null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleSave = async () => {
    if (!form.customer_name || !form.amount) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/estimates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), photos, customer_id: customerId }),
      });
      const est = await res.json();
      onSave(est);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "14px", fontWeight: 600, padding: "0", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px" }}>← Back</button>
      <SectionHeader title="Send Estimate" />
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
        <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Work to be performed..." /></div>
        <div><label style={labelStyle}>Amount * ($)</label><input style={inputStyle} type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" /></div>
        <div><label style={labelStyle}>Internal Notes</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes visible to customer..." /></div>
        <div>
          <label style={labelStyle}>Photos</label>
          <PhotoUpload photos={photos} onChange={setPhotos} />
        </div>
      </div>
      {form.phone && (
        <div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px", padding: "10px 12px", background: COLORS.surface, borderRadius: "6px", border: `1px solid ${COLORS.border}` }}>
          📱 SMS approval link will be sent to {form.phone}
        </div>
      )}
      <button onClick={handleSave} disabled={saving || !form.customer_name || !form.amount} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "14px", fontWeight: 800, cursor: "pointer", opacity: saving || !form.customer_name || !form.amount ? 0.6 : 1 }}>
        {saving ? "Sending..." : form.phone ? "Send Estimate via SMS" : "Create Estimate"}
      </button>
    </div>
  );
}

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
        action={<button onClick={() => onNavigate("new-job")} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: COLORS.accent, color: COLORS.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ New Job</button>}
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

// ============================================================
// PHOTO UPLOAD — reusable photo picker for estimates
// ============================================================
function PhotoUpload({ photos, onChange }) {
  const fileRef = React.useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let pending = files.length;
    const newPhotos = [];
    files.forEach(file => {
      // Compress slightly by resizing in a canvas
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          newPhotos.push({ data: canvas.toDataURL("image/jpeg", 0.75), name: file.name });
          pending--;
          if (pending === 0) onChange([...photos, ...newPhotos]);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: photos.length ? "10px" : 0 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
            <img src={p.data} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => remove(i)} style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: "20px", height: "20px", color: "#fff", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: "8px 16px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
        📷 {photos.length > 0 ? `Add More (${photos.length})` : "Add Photos"}
      </button>
    </div>
  );
}

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
            <div key={c.id} onClick={() => onNavigate("customer-detail", c)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: "8px" }}>
                  {c.name}
                  {c.source !== "manual" && <span style={{ fontSize: "10px", fontWeight: 700, background: sourceBg(c.source), color: sourceColor(c.source), padding: "2px 6px", borderRadius: "4px" }}>{sourceLabel(c.source)}</span>}
                </div>
                {c.phone && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>📞 {c.phone}</div>}
                {c.address && <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {c.address}</div>}
              </div>
              <div style={{ color: COLORS.textDim, fontSize: "16px", marginLeft: "8px" }}>›</div>
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
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St" /></div>
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
          />
        ) : null;
      case "billing":
        return <BillingScreen estimates={estimates} invoices={invoices} onNavigate={navigate} />;
      case "new-estimate":
        return (
          <NewEstimateScreen
            onBack={() => navigate("billing")}
            onSave={() => { loadData(); navigate("billing"); }}
            initialData={selectedItem}
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

      <div className="app-content" style={{ flex: 1, overflowY: "auto" }}>
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
