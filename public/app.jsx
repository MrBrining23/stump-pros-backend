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
};

const STATUS_CONFIG = {
  new: { label: "New", color: COLORS.accent, bg: COLORS.accentDim + "40" },
  contacted: { label: "Contacted", color: COLORS.blue, bg: COLORS.blueDim + "40" },
  quoted: { label: "Quoted", color: COLORS.orange, bg: COLORS.orangeDim + "40" },
  converted: { label: "Converted", color: COLORS.green, bg: COLORS.greenDim + "40" },
  lost: { label: "Lost", color: COLORS.red, bg: COLORS.redDim + "40" },
  estimate: { label: "Estimate", color: COLORS.textMuted, bg: COLORS.border + "60" },
  scheduled: { label: "Scheduled", color: COLORS.blue, bg: COLORS.blueDim + "40" },
  in_progress: { label: "In Progress", color: COLORS.orange, bg: COLORS.orangeDim + "40" },
  completed: { label: "Completed", color: COLORS.green, bg: COLORS.greenDim + "40" },
  invoiced: { label: "Invoiced", color: COLORS.accent, bg: COLORS.accentDim + "40" },
  paid: { label: "Paid", color: COLORS.green, bg: COLORS.greenDim + "40" },
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
  if (!amount) return "$0";
  return `$${Number(amount).toLocaleString()}`;
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
      background: "none", border: "none", padding: "8px 12px", cursor: "pointer",
      color: active ? COLORS.accent : COLORS.textMuted, position: "relative",
      transition: "color 0.15s",
    }}>
      <span style={{ fontSize: "22px", lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px" }}>{label}</span>
      {badge > 0 && (
        <span style={{
          position: "absolute", top: "2px", right: "4px", width: "18px", height: "18px",
          borderRadius: "50%", background: COLORS.red, color: "#fff",
          fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
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
    onMouseLeave={e => { if (onClick) { e.currentTarget.style.borderColor = style && style.borderColor ? style.borderColor : COLORS.border; e.currentTarget.style.background = COLORS.surface; }}}
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
      {lead.stump_count && (
        <div style={{ fontSize: "12px", color: COLORS.textMuted, marginTop: "2px" }}>
          🪵 {lead.stump_count} stump{lead.stump_count > 1 ? "s" : ""}
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
          <a href={`tel:${lead.phone}`} style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>📞</span>
            <div>
              <div style={{ fontWeight: 600 }}>{lead.phone}</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to call</div>
            </div>
          </a>
        )}
        {lead.phone && (
          <a href={`sms:${lead.phone}`} style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>💬</span>
            <div>
              <div style={{ fontWeight: 600 }}>Send a text</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Opens Messages app</div>
            </div>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>📧</span>
            <div>
              <div style={{ fontWeight: 600 }}>{lead.email}</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to email</div>
            </div>
          </a>
        )}
        {lead.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <div>
              <div style={{ fontWeight: 600 }}>{lead.address}</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap for directions</div>
            </div>
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
function JobDetail({ job, onBack, onUpdateStatus }) {
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
          <a href={`tel:${job.phone}`} style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>📞</span>
            <div>
              <div style={{ fontWeight: 600 }}>{job.phone}</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap to call</div>
            </div>
          </a>
        )}
        {job.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
            background: COLORS.surface, borderRadius: "8px", border: `1px solid ${COLORS.border}`,
            color: COLORS.text, textDecoration: "none", fontSize: "14px",
          }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <div>
              <div style={{ fontWeight: 600 }}>{job.address}</div>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>Tap for directions</div>
            </div>
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
    </div>
  );
}

// ============================================================
// NEW LEAD FORM
// ============================================================
function NewLeadScreen({ onBack, onSave }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", source: "website", contact_preference: "text", stump_count: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: COLORS.text, fontSize: "14px", padding: "10px 12px", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, stump_count: form.stump_count ? parseInt(form.stump_count) : null }),
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
        <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Customer name" /></div>
        <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="304-555-0000" /></div>
        <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, Charleston, WV" /></div>
        <div><label style={labelStyle}>Stump Count</label><input style={inputStyle} type="number" value={form.stump_count} onChange={e => set("stump_count", e.target.value)} placeholder="0" /></div>
        <div>
          <label style={labelStyle}>Source</label>
          <select style={inputStyle} value={form.source} onChange={e => set("source", e.target.value)}>
            <option value="website">Website</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
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
        body: JSON.stringify({ ...form, stump_count: form.stump_count ? parseInt(form.stump_count) : null, amount: form.amount ? parseFloat(form.amount) : null }),
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
        <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={form.customer_name} onChange={e => set("customer_name", e.target.value)} placeholder="Customer name" /></div>
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
// SCREENS
// ============================================================
function DashboardScreen({ leads, jobs, onNavigate }) {
  const newLeads = leads.filter(l => l.status === "new").length;
  const todayJobs = jobs.filter(j => j.scheduled_date === new Date().toISOString().split("T")[0]);
  const revenue = jobs.filter(j => j.status === "paid" || j.status === "invoiced").reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);
  const completedThisMonth = jobs.filter(j => j.status === "completed" || j.status === "invoiced" || j.status === "paid").length;

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
          <div style={{ fontSize: "28px", fontWeight: 900, color: COLORS.green, letterSpacing: "-1px" }}>{formatCurrency(revenue)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Completed</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: COLORS.text, letterSpacing: "-1px" }}>{completedThisMonth}</div>
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

function SettingsScreen() {
  const [autoText, setAutoText] = useState("Hey {{name}}, thanks for reaching out to Stump Pros WV! How many stumps do you need removed?");
  const [reviewDelay, setReviewDelay] = useState("24");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [facebookReviewUrl, setFacebookReviewUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/settings`).then(r => r.json()).then(s => {
      if (s.auto_text) setAutoText(s.auto_text);
      if (s.review_delay) setReviewDelay(String(s.review_delay));
      if (s.google_review_url) setGoogleReviewUrl(s.google_review_url);
      if (s.facebook_review_url) setFacebookReviewUrl(s.facebook_review_url);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    await fetch(`${API_BASE}/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_text: autoText, review_delay: parseInt(reviewDelay), google_review_url: googleReviewUrl, facebook_review_url: facebookReviewUrl }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionHeader title="Settings" />

      <Card style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Auto-Response Text Message</div>
        <textarea value={autoText} onChange={e => setAutoText(e.target.value)} rows={5} style={{
          width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px",
          color: COLORS.text, fontSize: "13px", padding: "10px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
          boxSizing: "border-box",
        }} />
        <div style={{ fontSize: "11px", color: COLORS.textDim, marginTop: "6px" }}>
          Use {"{{name}}"} for the customer's name
        </div>
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
          <input type="url" value={googleReviewUrl} onChange={e => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/..." style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px",
            color: COLORS.text, fontSize: "13px", padding: "8px 10px", boxSizing: "border-box",
          }} />
        </div>
        <div>
          <label style={{ fontSize: "12px", color: COLORS.textMuted, display: "block", marginBottom: "4px" }}>Facebook Review URL</label>
          <input type="url" value={facebookReviewUrl} onChange={e => setFacebookReviewUrl(e.target.value)} placeholder="https://facebook.com/stumpproswv/reviews" style={{
            width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: "6px",
            color: COLORS.text, fontSize: "13px", padding: "8px 10px", boxSizing: "border-box",
          }} />
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
function StumpProsApp() {
  const [screen, setScreen] = useState("dashboard");
  const [selectedItem, setSelectedItem] = useState(null);
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useCallback((target, item = null) => {
    setScreen(target);
    setSelectedItem(item);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [leadsRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/leads`),
        fetch(`${API_BASE}/jobs`),
      ]);
      setLeads(await leadsRes.json());
      setJobs(await jobsRes.json());
    } catch (err) {
      console.error("Load error:", err);
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

  const convertLead = async (lead) => {
    const res = await fetch(`${API_BASE}/leads/${lead.id}/convert`, { method: "POST" });
    const newJob = await res.json();
    await loadData();
    navigate("job-detail", newJob);
  };

  const newLeadCount = leads.filter(l => l.status === "new").length;
  const activeTab = screen === "dashboard" ? "dashboard" : screen.includes("lead") ? "leads" : screen.includes("job") ? "jobs" : screen;

  const renderScreen = () => {
    switch (screen) {
      case "dashboard": return <DashboardScreen leads={leads} jobs={jobs} onNavigate={navigate} />;
      case "leads": return <LeadsScreen leads={leads} onNavigate={navigate} />;
      case "new-lead": return <NewLeadScreen onBack={() => navigate("leads")} onSave={(lead) => { loadData(); navigate("lead-detail", lead); }} />;
      case "lead-detail": return selectedItem ? <LeadDetail lead={selectedItem} onBack={() => navigate("leads")} onConvert={convertLead} onUpdateStatus={updateLeadStatus} /> : null;
      case "jobs": return <JobsScreen jobs={jobs} onNavigate={navigate} />;
      case "new-job": return <NewJobScreen onBack={() => navigate("jobs")} onSave={(job) => { loadData(); navigate("job-detail", job); }} />;
      case "job-detail": return selectedItem ? <JobDetail job={selectedItem} onBack={() => navigate("jobs")} onUpdateStatus={updateJobStatus} /> : null;
      case "settings": return <SettingsScreen />;
      default: return <DashboardScreen leads={leads} jobs={jobs} onNavigate={navigate} />;
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.textMuted, fontSize: "14px" }}>Loading...</div>
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

      <div style={{ flex: 1, padding: "20px 16px 100px 16px", overflowY: "auto" }}>
        {renderScreen()}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: "480px",
        background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px) 0",
        zIndex: 100,
      }}>
        <IconButton icon="🏠" label="Home" active={activeTab === "dashboard"} onClick={() => navigate("dashboard")} />
        <IconButton icon="📋" label="Leads" active={activeTab === "leads"} onClick={() => navigate("leads")} badge={newLeadCount} />
        <IconButton icon="🪵" label="Jobs" active={activeTab === "jobs"} onClick={() => navigate("jobs")} />
        <IconButton icon="⚙️" label="Settings" active={activeTab === "settings"} onClick={() => navigate("settings")} />
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(StumpProsApp));
