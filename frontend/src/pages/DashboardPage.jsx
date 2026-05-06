import { useState, useEffect, useRef } from 'react';
import { getAnalytics } from '../api/client';

// ── SVG Donut Chart ───────────────────────────────────────────────────────────
function DonutChart({ data, size = 140 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);

  let offset = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const seg  = { ...d, dash, gap, offset: offset * circumference };
    offset += pct;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} className="donut-svg">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-primary)" strokeWidth={size * 0.18} />
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={size * 0.18} />
        ) : (
          segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={size * 0.18}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
            />
          ))
        )}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize={size * 0.18} fontWeight="800">
          {total}
        </text>
        <text x={cx} y={cy + size * 0.14} textAnchor="middle" fill="var(--text-muted)" fontSize={size * 0.09}>
          total
        </text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: d.color }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-count" style={{ paddingLeft: 12 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-row">
          <div className="bar-label-row">
            <span className="bar-label">{d.label}</span>
            <span className="bar-count">{d.value}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Animated Counter ──────────────────────────────────────────────────────────
function Counter({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let start = 0;
    const target = Number(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setDisplay(start);
      if (start >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}{suffix}</>;
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
const TYPE_META = {
  rag:     { icon: '📚', label: 'RAG',     color: 'var(--blue)' },
  action:  { icon: '⚡', label: 'Action',  color: 'var(--green)' },
  general: { icon: '💬', label: 'General', color: 'var(--amber)' },
  error:   { icon: '⚠️', label: 'Error',   color: 'var(--red)' },
};

function ActivityFeed({ logs }) {
  if (!logs?.length) {
    return (
      <div className="empty-state" style={{ padding: '30px 20px' }}>
        <div className="empty-icon">📭</div>
        <span>No queries yet — start chatting to see activity</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {logs.map((log, i) => {
        const meta = TYPE_META[log.type] || TYPE_META.general;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 16 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: meta.color, fontWeight: 600 }}>{log.subtype || meta.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="time-pill">{log.responseTime}ms</span>
                {!log.success && <span className="badge badge-error" style={{ padding: '1px 6px', fontSize: 10 }}>failed</span>}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await getAnalytics();
      setData(d);
      setLastRefresh(new Date());
    } catch (_) {
      // silent fail on refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, []);

  const q = data?.queries || {};
  const queryDist = q.distribution || {};
  const acts = data?.actions || {};
  const actDist = acts.distribution || {};
  const docs = data?.documents || {};
  const sessions = data?.sessions || {};

  const donutData = [
    { label: 'RAG',     value: queryDist.rag     || 0, color: 'var(--blue)'   },
    { label: 'Action',  value: queryDist.action  || 0, color: 'var(--green)'  },
    { label: 'General', value: queryDist.general || 0, color: 'var(--amber)'  },
    { label: 'Errors',  value: queryDist.error   || 0, color: 'var(--red)'    },
  ];

  const actionBars = [
    { label: '📅 Book Appointment', value: actDist.bookAppointment || 0, color: 'var(--green)' },
    { label: '🎯 Create Lead',      value: actDist.createLead       || 0, color: 'var(--blue)'  },
    { label: '🤖 RPA Automation',   value: actDist.processAutomation || 0, color: 'var(--accent)'},
    { label: '📦 Check Status',     value: actDist.checkStatus      || 0, color: 'var(--amber)' },
    { label: '🎧 Escalate',         value: actDist.escalateToHuman  || 0, color: 'var(--red)'   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📊 Dashboard</div>
          <div className="page-subtitle">Real-time platform analytics · auto-refreshes every 30s</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => fetchData()}>
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
        </div>
      </div>

      <div className="dashboard-layout">
        {loading && !data ? (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <span className="spinner" style={{ width: 36, height: 36 }} />
            <span style={{ marginTop: 16 }}>Loading analytics…</span>
          </div>
        ) : (
          <>
            {/* ── Stats Grid ── */}
            <div className="stats-grid">
              {[
                { label: 'Total Queries',   value: q.total || 0, icon: '💬', color: 'var(--accent)',  sub: 'All time' },
                { label: 'RAG Queries',     value: queryDist.rag || 0, icon: '📚', color: 'var(--blue)',    sub: 'Knowledge base lookups' },
                { label: 'Actions Taken',   value: queryDist.action || 0, icon: '⚡', color: 'var(--green)',   sub: 'Booking, leads, status' },
                { label: 'Avg Resp. Time',  value: q.avgResponseTime || 0, icon: '⏱', color: 'var(--amber)', suffix: 'ms', sub: 'End-to-end latency' },
                { label: 'Documents',       value: docs.totalDocuments || 0, icon: '📄', color: 'var(--blue)', sub: `${docs.totalChunks || 0} chunks` },
                { label: 'Active Sessions', value: sessions.total || 0, icon: '👥', color: 'var(--green)', sub: `${sessions.live || 0} escalated` },
                { label: 'Leads Captured',  value: acts.totalLeads || 0, icon: '🎯', color: 'var(--accent)', sub: 'CRM entries' },
                { label: 'Bookings Made',   value: acts.totalBookings || 0, icon: '📅', color: 'var(--amber)', sub: 'Appointments' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ '--stat-color': s.color }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value">
                    <Counter value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Charts Row ── */}
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-title">Query Distribution</div>
                <DonutChart data={donutData} size={150} />
              </div>

              <div className="chart-card">
                <div className="chart-title">Action Breakdown</div>
                {actionBars.every(b => b.value === 0) ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-icon" style={{ fontSize: 28 }}>⚡</div>
                    <span>No actions triggered yet</span>
                  </div>
                ) : (
                  <BarChart data={actionBars} />
                )}
              </div>
            </div>

            {/* ── Recent Activity ── */}
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom: 0 }}>
                🕐 Recent Activity
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  Last 20 queries
                </span>
              </div>
              <div style={{ marginTop: 14 }}>
                <ActivityFeed logs={data?.recentQueries || []} />
              </div>
            </div>

            {/* ── System Status ── */}
            <div className="chart-card">
              <div className="chart-title">🛠 System Status</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { label: 'AI Model',     value: 'GPT-4o-mini', status: 'online', icon: '🤖' },
                  { label: 'Vector DB',    value: 'Weaviate Cloud', status: 'online', icon: '🔮' },
                  { label: 'Agent Layer',  value: 'LLM-based routing', status: 'online', icon: '🧠' },
                  { label: 'RAG Pipeline', value: 'text-embedding-3-small', status: 'online', icon: '📚' },
                  { label: 'Memory',       value: `${sessions.totalMessages || 0} messages`, status: 'online', icon: '💾' },
                  { label: 'Error Rate',   value: q.total > 0 ? `${((q.errors / q.total) * 100).toFixed(1)}%` : '0%', status: (q.errors || 0) > (q.total || 1) * 0.1 ? 'warn' : 'online', icon: '⚠️' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>{s.value}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', display: 'block',
                        background: s.status === 'online' ? 'var(--green)' : 'var(--amber)',
                        boxShadow: `0 0 6px ${s.status === 'online' ? 'var(--green)' : 'var(--amber)'}`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
