import { useState } from 'react';

const AGENT_COLORS = {
  orchestrator: 'var(--accent)',
  rag: 'var(--blue)',
  action: 'var(--green)',
  critic: 'var(--amber)',
  synthesizer: 'var(--accent-light)',
  none: 'var(--text-muted)'
};

const AGENT_ICONS = {
  orchestrator: '🧠',
  rag: '📚',
  action: '⚡',
  critic: '🔍',
  synthesizer: '✨',
  none: '💬'
};

export default function DebugPanel({ log }) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        style={{
          width: 36, minWidth: 36,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 16, cursor: 'pointer', gap: 6,
        }}
        onClick={() => setCollapsed(false)}
        title="Expand debug panel"
      >
        <span style={{ fontSize: 16, transform: 'rotate(180deg)', display: 'block' }}>◀</span>
        <span style={{
          fontSize: 10, color: 'var(--text-muted)', writingMode: 'vertical-rl',
          textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700,
        }}>Debug</span>
      </div>
    );
  }

  return (
    <div className="debug-sidebar">
      <div className="debug-header">
        <div className="debug-title">
          <span>⚙️</span> Multi-Agent ReAct Chain
        </div>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => setCollapsed(true)}
          title="Collapse"
          style={{ padding: '4px 8px', fontSize: 13 }}
        >
          ▶
        </button>
      </div>

      <div className="debug-body">
        {!log ? (
          <div className="debug-empty">
            <span style={{ fontSize: 32 }}>🤖</span>
            <strong style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Waiting for query...</strong>
            <span>Send a message to watch the Orchestrator plan, execute, and evaluate agents.</span>
          </div>
        ) : (
          <>
            {/* ── 1. Orchestrator Plan ── */}
            {log.orchestratorThought && (
              <div className="debug-section" style={{ borderColor: 'var(--accent-glow)' }}>
                <div className="debug-section-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{AGENT_ICONS.orchestrator} Orchestrator Thought</span>
                  <span>{log.planLatency ? `${log.planLatency}ms` : ''}</span>
                </div>
                <div className="debug-section-body">
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    "{log.orchestratorThought}"
                  </div>
                  
                  {log.plan && log.plan.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="debug-key" style={{ marginBottom: 8 }}>Execution Plan:</div>
                      {log.plan.map((step, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', gap: 8, alignItems: 'flex-start',
                          padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 4
                        }}>
                          <span style={{ 
                            background: AGENT_COLORS[step.agent] || 'var(--text-muted)', 
                            color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                            textTransform: 'uppercase' 
                          }}>
                            {step.agent}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{step.task}</span>
                          {step.parallel && <span title="Runs in parallel" style={{ fontSize: 12 }}>⏸️</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="debug-kv" style={{ marginTop: 10 }}>
                    <span className="debug-key">Complexity:</span>
                    <span className="debug-val" style={{ color: log.complexity === 'high' ? 'var(--amber)' : 'var(--text-secondary)' }}>
                      {log.complexity?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. Agent Execution Timeline ── */}
            {log.agentChain && log.agentChain.length > 0 && (
              <div className="debug-section">
                <div className="debug-section-header">⚡ Pipeline Execution</div>
                <div className="debug-section-body" style={{ padding: '8px 0' }}>
                  <div className="timeline-container">
                    {log.agentChain.map((step, i) => (
                      <div key={i} className="timeline-node">
                        <div className="node-side">
                          <span className="node-icon" style={{ background: AGENT_COLORS[step.agent] }}>
                            {AGENT_ICONS[step.agent]}
                          </span>
                          {i < log.agentChain.length - 1 && <div className="node-line" />}
                        </div>
                        <div className="node-content">
                          <div className="node-title">
                            {step.stepId.toUpperCase()}
                            {step.status !== 'running' && <span className="node-latency">{step.latency}ms</span>}
                          </div>
                          <div className="node-task">{step.task}</div>
                          <div className="node-summary">
                            {step.status === 'running' ? (
                              <span className="typing-micro">Processing...</span>
                            ) : (
                              step.summary
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Retrieved Sources (if any RAG) ── */}
            {log.retrievedSources && log.retrievedSources.length > 0 && (
              <div className="debug-section">
                <div className="debug-section-header">📚 Grounding Evidence ({log.retrievedSources.length})</div>
                <div className="debug-section-body" style={{ padding: 0 }}>
                  {log.retrievedSources.map((ctx, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderBottom: i < log.retrievedSources.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>📄 {ctx.source}</span>
                        {ctx.score != null && (
                          <span style={{ fontSize: 10, background: 'var(--blue-subtle)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>
                            {Math.round(ctx.score * 100)}% Match
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. Critic Evaluation ── */}
            {log.critique && (
              <div className="debug-section" style={{ borderColor: log.critique.approved ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)' }}>
                <div className="debug-section-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{AGENT_ICONS.critic} Critic Evaluation</span>
                  <span style={{ color: log.critique.approved ? 'var(--green)' : 'var(--amber)' }}>
                    {log.critique.approved ? 'PASS' : 'WARN'} ({log.critique.overallScore}/10)
                  </span>
                </div>
                <div className="debug-section-body">
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    "{log.critique.critiqueSummary}"
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {Object.entries(log.critique.scores || {}).map(([key, score]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                        <span style={{ fontWeight: 600, color: score >= 8 ? 'var(--green)' : score >= 5 ? 'var(--amber)' : 'var(--red)' }}>{score}/10</span>
                      </div>
                    ))}
                  </div>

                  {log.critique.issues?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="debug-key" style={{ color: 'var(--red)', marginBottom: 4 }}>Issues Found:</div>
                      <ul style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 16, margin: 0 }}>
                        {log.critique.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                  {log.critique.suggestions?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="debug-key" style={{ color: 'var(--amber)', marginBottom: 4 }}>Refinements passed to Synthesizer:</div>
                      <ul style={{ fontSize: 11, color: 'var(--accent-light)', paddingLeft: 16, margin: 0 }}>
                        {log.critique.suggestions.map((sug, i) => <li key={i}>{sug}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Timing & Errors ── */}
            {log.totalLatency && (
              <div className="debug-section">
                <div className="debug-section-header">⏱ Pipeline Analytics</div>
                <div className="debug-section-body">
                  <div className="debug-kv">
                    <span className="debug-key">End-to-End Latency</span>
                    <span className="debug-val" style={{ color: log.totalLatency < 3000 ? 'var(--green)' : log.totalLatency < 6000 ? 'var(--amber)' : 'var(--red)' }}>
                      {log.totalLatency}ms
                    </span>
                  </div>
                  <div className="debug-kv">
                    <span className="debug-key">Session ID</span>
                    <span className="debug-val">{log.sessionId?.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>
            )}

            {log.error && (
              <div className="debug-section" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                <div className="debug-section-header" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>⚠️ Pipeline Error</div>
                <div className="debug-section-body">
                  <div style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {log.error}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
