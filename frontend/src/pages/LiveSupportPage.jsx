/**
 * LiveSupportPage.jsx
 * Advanced Agent Platform Console:
 *  - Queue management for live escalations
 *  - Archives / Insights for past user conversations
 *  - High-concurrency handovers
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  getSessions, getSessionDetails,
  initSocket, joinSocketSession, sendSocketMessage,
  updateSessionStatus, registerSocketListener, unregisterSocketListener
} from '../api/client';

export default function LiveSupportPage() {
  const [sessions,     setSessions]      = useState([]);
  const [selectedId,   setSelectedId]    = useState(null);
  const [history,      setHistory]       = useState([]);
  const [input,        setInput]         = useState('');
  const [tab,          setTab]           = useState('queue'); // queue | archive
  const [showInsights, setShowInsights] = useState(false);
  
  const messagesEndRef = useRef(null);

  // ── Session List Fetching ──────────────────────────────────────────────────
  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchSessions();
    const iv = setInterval(fetchSessions, 5000);
    return () => clearInterval(iv);
  }, []);

  // ── Session Detail & Socket ──────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions();
  }, [tab]);

  // ── Session Detail & Socket ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }

    (async () => {
      try {
        const data = await getSessionDetails(selectedId);
        setHistory(data.messages || []);
      } catch (e) {
        toast.error('Failed to load history');
      }
    })();

    initSocket();
    const handleIncoming = (data) => {
      if (data.sessionId !== selectedId) return;
      // Admin only adds messages from USER to prevent duplicates (own msgs added optimistically)
      if (data.role === 'user') {
        setHistory(prev => [...prev, {
          role: data.role, content: data.content, timestamp: new Date().toISOString()
        }]);
      }
    };

    registerSocketListener(`admin-${selectedId}`, handleIncoming);
    joinSocketSession(selectedId);
    
    return () => unregisterSocketListener(`admin-${selectedId}`);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || !selectedId) return;
    const msg = input.trim();
    setInput('');
    // Optimistic Update
    setHistory(prev => [...prev, { role: 'assistant', content: msg, timestamp: new Date().toISOString() }]);
    sendSocketMessage(selectedId, 'assistant', msg);
  };

  const resolveChat = async () => {
    if (!selectedId) return;
    try {
      await updateSessionStatus(selectedId, 'closed', false);
      toast.success('Conversation resolved and archived.');
      setSelectedId(null);
      setHistory([]);
      fetchSessions();
    } catch (_) {
      toast.error('Failed to resolve.');
    }
  };

  // ── Insights Calculation ─────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!history.length) return null;
    const userMsgs = history.filter(m => m.role === 'user').length;
    const aiMsgs   = history.filter(m => m.role === 'assistant').length;
    const actions  = history.filter(m => m.meta?.source === 'action_agent').length;
    const sources  = [...new Set(history.flatMap(m => m.meta?.sources?.map(s => s.source) || []))];
    
    return { userMsgs, aiMsgs, actions, sources };
  }, [history]);

  // Filtered lists
  const queueSessions   = sessions.filter(s => s.status === 'live_agent' || s.isEscalated);
  const archiveSessions = sessions.filter(s => s.status === 'closed');
  const activeList      = tab === 'queue' ? queueSessions : archiveSessions;

  const currentSession = sessions.find(s => s.sessionId === selectedId);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* ── Sidebar: List ── */}
      <div style={{ width: 320, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>🎧 Admin Console</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              className={`btn btn-sm ${tab === 'queue' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setTab('queue'); setSelectedId(null); }}
              style={{ flex: 1 }}
            >
              Queue ({queueSessions.length})
            </button>
            <button 
              className={`btn btn-sm ${tab === 'archive' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setTab('archive'); setSelectedId(null); }}
              style={{ flex: 1 }}
            >
              Log ({archiveSessions.length})
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeList.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              {tab === 'queue' ? 'Inbox zero! No active escalations.' : 'No archived conversations yet.'}
            </div>
          ) : (
            activeList.map(s => (
              <div
                key={s.sessionId}
                onClick={() => setSelectedId(s.sessionId)}
                style={{
                  padding: '16px 24px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  background: selectedId === s.sessionId ? 'var(--accent-subtle)' : 'transparent',
                  borderLeft: selectedId === s.sessionId ? '4px solid var(--accent)' : '4px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name || 'Anonymous User'}</div>
                  {s.status === 'live_agent' && (
                    <span style={{ width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', boxShadow: '0 0 8px var(--red)' }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {s.sessionId.slice(0, 8)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Last active: {s.lastActive ? new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main: Chat & Insights ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
        {selectedId ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{currentSession?.name || 'Session Detail'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status: {currentSession?.status?.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowInsights(!showInsights)}>
                  {showInsights ? '💬 View Chat' : '📊 View Insights'}
                </button>
                {tab === 'queue' && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} onClick={resolveChat}>
                    Complete & Resolve
                  </button>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              
              {/* Chat Messages */}
              <div style={{ 
                flex: 1, display: 'flex', flexDirection: 'column', 
                visibility: showInsights ? 'hidden' : 'visible',
                position: showInsights ? 'absolute' : 'relative',
                width: '100%', height: '100%'
              }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {history.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '75%' }}>
                      <div style={{ 
                        fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, 
                        textAlign: m.role === 'user' ? 'left' : 'right', fontWeight: 600
                      }}>
                        {m.role === 'user' ? 'Customer' : 'Agent'} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ 
                        padding: '12px 16px', borderRadius: 14, fontSize: 14, lineHeight: 1.55,
                        background: m.role === 'user' ? 'var(--bg-card)' : 'var(--accent)',
                        border: m.role === 'user' ? '1px solid var(--border)' : 'none',
                        color: m.role === 'user' ? 'var(--text-primary)' : 'white',
                        boxShadow: m.role === 'user' ? 'none' : '0 4px 12px var(--accent-glow)'
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input only in Queue mode */}
                {tab === 'queue' && (
                  <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <input 
                        type="text" 
                        className="chat-textarea" 
                        style={{ flex: 1, height: 48, padding: '0 18px', borderRadius: 12 }}
                        placeholder="Type a message to the user..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                      />
                      <button className="btn btn-primary" onClick={handleSend}>Send Msg</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Insights Panel */}
              {showInsights && (
                <div style={{ flex: 1, padding: 32, overflowY: 'auto', background: 'var(--bg-primary)' }}>
                  <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <h3 style={{ marginBottom: 24, fontSize: 20 }}>📊 Conversation Insights</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                      <div className="stat-card" style={{ padding: 20 }}>
                        <div className="stat-label">User Messages</div>
                        <div className="stat-value" style={{ fontSize: 28 }}>{insights?.userMsgs}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 20 }}>
                        <div className="stat-label">Assistant Replies</div>
                        <div className="stat-value" style={{ fontSize: 28 }}>{insights?.aiMsgs}</div>
                      </div>
                    </div>

                    <div className="card" style={{ marginBottom: 24 }}>
                      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>🤖 Agent Automation</div>
                      <div style={{ fontSize: 15, marginBottom: 8 }}>
                        The AI handled <strong>{insights?.aiMsgs}</strong> replies and executed <strong>{insights?.actions}</strong> specialized actions.
                      </div>
                    </div>

                    <div className="card">
                      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>📚 Knowledge Context</div>
                      {insights?.sources.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No local documents were used in this session.</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {insights?.sources.map((s, i) => (
                            <span key={i} className="badge badge-rag" style={{ padding: '6px 12px' }}>📄 {s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.5 }}>🎧</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Select a customer to begin</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Monitor real-time escalations and session data.</div>
          </div>
        )}
      </div>
    </div>
  );
}
