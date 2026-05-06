import { useState, useEffect, useCallback } from 'react';
import { getAnalytics } from '../api/client';

const TYPE_META = {
  rag:     { icon: '📚', cls: 'badge-rag',     label: 'RAG'     },
  action:  { icon: '⚡', cls: 'badge-action',  label: 'Action'  },
  general: { icon: '💬', cls: 'badge-general', label: 'General' },
  error:   { icon: '⚠️', cls: 'badge-error',   label: 'Error'   },
};

const FILTERS = ['all', 'rag', 'action', 'general', 'error'];

export default function DebugPage() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAnalytics();
      setLogs(data.recentQueries || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(true), 15_000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🔍 Debug Logs</div>
          <div className="page-subtitle">Agent decisions, response types, and timing — live feed</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Auto-refresh toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => setAutoRefresh(r => !r)}
              style={{
                width: 36, height: 20, borderRadius: 99, background: autoRefresh ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2, left: autoRefresh ? 19 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </div>
            Live
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => fetchLogs()}>
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
        </div>
      </div>

      <div className="debug-full-layout">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const meta = TYPE_META[f];
            const count = f === 'all' ? logs.length : logs.filter(l => l.type === f).length;
            return (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f)}
                style={{ gap: 6 }}
              >
                {meta?.icon || '📋'} {f.charAt(0).toUpperCase() + f.slice(1)}
                <span style={{
                  background: filter === f ? 'rgba(255,255,255,0.2)' : 'var(--bg-primary)',
                  borderRadius: 99, padding: '1px 7px', fontSize: 11,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Logs Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading && !logs.length ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
              <span style={{ marginTop: 12 }}>Loading logs…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-icon">📭</div>
              <strong style={{ color: 'var(--text-secondary)' }}>No logs found</strong>
              <span>{filter !== 'all' ? `No "${filter}" queries yet.` : 'Start chatting to see agent logs here.'}</span>
            </div>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Sub-type / Action</th>
                  <th>Response Time</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => {
                  const meta = TYPE_META[log.type] || TYPE_META.general;
                  const isExpanded = expanded === i;
                  return (
                    <>
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : i)}>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                          {filtered.length - i}
                        </td>
                        <td>
                          <span className={`badge ${meta.cls}`}>{meta.icon} {meta.label}</span>
                        </td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {log.subtype || '—'}
                        </td>
                        <td>
                          <span className="time-pill" style={{
                            color: !log.responseTime ? 'var(--text-muted)'
                              : log.responseTime < 2000 ? 'var(--green)'
                              : log.responseTime < 5000 ? 'var(--amber)'
                              : 'var(--red)',
                          }}>
                            {log.responseTime ? `${log.responseTime}ms` : '—'}
                          </span>
                        </td>
                        <td>
                          {log.success
                            ? <span style={{ color: 'var(--green)', fontSize: 12.5, fontWeight: 600 }}>✓ Success</span>
                            : <span style={{ color: 'var(--red)',   fontSize: 12.5, fontWeight: 600 }}>✗ Failed</span>
                          }
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {isExpanded ? '▲' : '▼'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${i}-detail`}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{
                              background: 'var(--bg-primary)', padding: '14px 20px',
                              borderBottom: '1px solid var(--border)',
                              fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Detail</div>
                                  <div><strong>Type:</strong> {log.type}</div>
                                  {log.subtype && <div><strong>Sub-type:</strong> {log.subtype}</div>}
                                  <div><strong>Success:</strong> {log.success ? 'Yes' : 'No'}</div>
                                  <div><strong>Response time:</strong> {log.responseTime}ms</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Performance</div>
                                  <div><strong>Category:</strong>{' '}
                                    <span style={{ color: log.responseTime < 2000 ? 'var(--green)' : log.responseTime < 5000 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>
                                      {!log.responseTime ? '—' : log.responseTime < 2000 ? 'Fast' : log.responseTime < 5000 ? 'Normal' : 'Slow'}
                                    </span>
                                  </div>
                                  <div><strong>Timestamp:</strong> {new Date(log.timestamp).toISOString()}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Legend */}
        <div className="card" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent-glow)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--accent-light)' }}>
            🧠 How the Agent Decision System Works
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>📚 RAG (Retrieval)</div>
              User query → LLM classifies as "informational" → Weaviate semantic search retrieves top-3 relevant document chunks → LLM synthesizes a grounded answer.
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>⚡ Action (Agentic)</div>
              User query → LLM classifies as "actionable" → extracts structured parameters → dispatches to handler (bookAppointment, createLead, checkStatus, escalate).
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>💬 General (Conversational)</div>
              Greetings, small talk, or ambiguous queries that don't map to the knowledge base or actions. Handled with a friendly conversational prompt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
