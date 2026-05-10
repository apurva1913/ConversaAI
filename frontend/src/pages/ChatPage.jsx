/**
 * ChatPage.jsx
 * User-facing chat UI with:
 *  - AI orchestrator (RAG, Actions, RPA, Critic)
 *  - Live Agent mode (no LLM once escalated)
 *  - Voice input (Web Speech API) + Voice output (TTS)
 *  - RPA extracted data table
 *  - Persistent session history via MongoDB
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  sendMessage, getSessionDetails, initSocket,
  joinSocketSession, sendSocketMessage,
  registerSocketListener, unregisterSocketListener
} from '../api/client';
import DebugPanel from '../components/DebugPanel';
import RPABrowser from '../components/RPABrowser';

// ─────────────────────────────────────────────────────────
//  Markdown renderer (sanitised)
// ─────────────────────────────────────────────────────────
function renderMd(text = '') {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/^### (.+)/gm,    '<h4>$1</h4>')
    .replace(/^## (.+)/gm,     '<h3>$1</h3>')
    .replace(/^# (.+)/gm,      '<h2>$1</h2>')
    .replace(/^[-*] (.+)/gm,   '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>')
    .replace(/\n\n/g,           '</p><p>')
    .replace(/^(?!<[hup]|<li)(.+)$/gm, (_, l) => l ? `<p>${l}</p>` : '');
}

// ─────────────────────────────────────────────────────────
//  Mini components
// ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
    </div>
  );
}

function RPADataViewer({ data }) {
  if (!data || typeof data !== 'object' || !Object.keys(data).length) return null;
  return (
    <div className="rpa-data-card">
      <div className="rpa-data-header">🤖 RPA — EXTRACTED DATA</div>
      <table className="rpa-table"><tbody>
        {Object.entries(data).map(([k, v]) => (
          <tr key={k}>
            <td className="rpa-key">{k.toUpperCase()}</td>
            <td className="rpa-val">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

function VoiceButton({ text }) {
  const [speaking, setSpeaking] = useState(false);
  const speak = () => {
    if (!('speechSynthesis' in window)) return toast.error('TTS not supported');
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, ''));
    u.rate = 1.05; u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  return (
    <button className={`voice-btn ${speaking ? 'speaking' : ''}`} onClick={speak} title="Read aloud">
      {speaking ? '🔊' : '🔈'}
    </button>
  );
}

const BADGE_MAP = {
  rag:        { cls: 'badge-rag',     icon: '📚', label: 'Knowledge' },
  action:     { cls: 'badge-action',  icon: '⚡', label: 'Action'    },
  rpa:        { cls: 'badge-rpa',     icon: '🤖', label: 'RPA'       },
  general:    { cls: 'badge-general', icon: '💬', label: 'General'   },
  live_agent: { cls: 'badge-live',    icon: '👩‍💼', label: 'Agent'    },
  error:      { cls: 'badge-error',   icon: '⚠️', label: 'Error'     },
};
function ResponseBadge({ type }) {
  const key = (type === 'action' || type === 'rpa') ? type : (type || 'general');
  const b   = BADGE_MAP[key] || BADGE_MAP.general;
  return <span className={`badge ${b.cls}`}>{b.icon} {b.label}</span>;
}

function SourcesPanel({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="sources-panel">
      <div className="sources-title">📎 Sources</div>
      {sources.map((s, i) => (
        <div key={i} className="source-item">
          <span className="source-score">{s.score ? `${Math.round(s.score*100)}%` : '—'}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.source}</span>
        </div>
      ))}
    </div>
  );
}

const SUGGESTIONS = [
  '📅 Book a demo appointment for next Monday at 10 AM',
  '🤖 RPA: Bill from ACME $450 dated May 1 — extract & sync to ERP',
  '⚙️ Automation: Verify my account and process a refund for order #998',
  '🎧 Connect me with a live support agent',
];

// ─────────────────────────────────────────────────────────
//  Main ChatPage
// ─────────────────────────────────────────────────────────
export default function ChatPage() {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const sessionId = urlSessionId || uuidv4();

  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [debugLog,      setDebugLog]      = useState(null);
  const [statusText,    setStatusText]    = useState('');
  const [sessionStatus, setSessionStatus] = useState('active');
  const [isListening,   setIsListening]   = useState(false);
  const [agentTyping,   setAgentTyping]   = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const recognitionRef = useRef(null);

  // Redirect to get sessionId in URL
  useEffect(() => {
    if (!urlSessionId) navigate(`/chat/${sessionId}`, { replace: true });
  }, [urlSessionId]);

  // Load history + register socket
  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      try {
        const data = await getSessionDetails(sessionId);
        setMessages((data.messages || []).map(m => ({
          id: uuidv4(), ...m, streaming: false, sources: m.meta?.sources || []
        })));
        setSessionStatus(data.status || 'active');
      } catch (_) { setMessages([]); }
    })();

    initSocket();

    // ONLY add messages that come from 'assistant' role (agent replies)
    // This prevents duplicates — user messages were added optimistically
    const handleSocket = (data) => {
      if (data.sessionId !== sessionId) return;
      if (data.role === 'assistant') {
        setAgentTyping(false);
        setMessages(prev => [...prev, {
          id: uuidv4(), role: 'assistant', content: data.content,
          streaming: false, responseType: 'live_agent', sources: []
        }]);
        setSessionStatus('live_agent');
        // TTS auto-play for incoming agent messages
        if ('speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(data.content);
          u.rate = 1.05; window.speechSynthesis.speak(u);
        }
      }
    };

    registerSocketListener(`chat-${sessionId}`, handleSocket);
    joinSocketSession(sessionId);
    return () => unregisterSocketListener(`chat-${sessionId}`);
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentTyping]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // ── Voice Input ──────────────────────────────────────────
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return toast.error('Speech Recognition not supported in your browser.');

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setInput(transcript);
    };
    rec.onend = () => {
      setIsListening(false);
      // Auto-submit if we got something
      setInput(prev => { if (prev.trim()) setTimeout(() => submit(prev), 100); return prev; });
    };
    rec.onerror = () => { setIsListening(false); toast.error('Voice recognition failed.'); };

    recognitionRef.current = rec;
    rec.start();
  };

  // ── Send message ─────────────────────────────────────────
  const addMessage    = msg => setMessages(prev => [...prev, msg]);
  const updateMsg     = (id, patch) => setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

  const submit = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    // Optimistic user message (always show immediately)
    addMessage({ id: uuidv4(), role: 'user', content: msg });

    // Join room just to be safe (handles silent reconnections)
    joinSocketSession(sessionId);

    // ── Live Agent Mode: bypass AI, send via socket only ──
    if (sessionStatus === 'live_agent') {
      setAgentTyping(true);
      sendSocketMessage(sessionId, 'user', msg);
      // Typing indicator auto-clears when agent responds via socket
      setTimeout(() => setAgentTyping(false), 15000); // safety timeout
      return;
    }

    // ── AI Mode ──────────────────────────────────────────
    setLoading(true);
    setStatusText('');
    setDebugLog({ sessionId, userMessage: msg, timestamp: new Date().toISOString(), agentChain: [] });

    const aiId = uuidv4();
    addMessage({ id: aiId, role: 'assistant', content: '', streaming: true, responseType: null, sources: [] });

    try {
      let accumulated = '';
      let sources     = [];

      await sendMessage(msg, sessionId, {
        onStatus:        ({ message: s }) => setStatusText(s),
        onPlan:          ({ thought, steps, complexity, planLatency }) =>
          setDebugLog(p => ({ ...p, orchestratorThought: thought, plan: steps, complexity, planLatency })),
        onAgentStart:    payload =>
          setDebugLog(p => ({ ...p, agentChain: [...p.agentChain, { ...payload, status: 'running', startedAt: Date.now() }] })),
        onAgentComplete: payload =>
          setDebugLog(p => ({ ...p, agentChain: p.agentChain.map(s => s.stepId === payload.stepId ? { ...s, status: 'done', summary: payload.summary, latency: payload.latency } : s) })),
        onCritic:        payload => setDebugLog(p => ({ ...p, critique: payload })),
        onContext:       ({ sources: ctx }) => {
          sources = ctx || [];
          updateMsg(aiId, { sources });
          setDebugLog(p => ({ ...p, retrievedSources: sources }));
        },
        onChunk:   chunk => { accumulated += chunk; updateMsg(aiId, { content: accumulated, streaming: true }); },
        onDone:    (data) => {
          setDebugLog(data.debugLog);
          let rpaData = null;
          
          // Escalation: transition UI state
          if (data.responseType === 'action' && data.actionData?.ticketId) {
            setSessionStatus('live_agent');
            joinSocketSession(sessionId); // Ensure user is joined to room
            toast.success('Agent connected. AI is now standing by.', { icon: '👩‍💼' });
          }

          if (data.responseType === 'action' && data.actionData) {
            rpaData = data.actionData.details || data.actionData;
          }
          updateMsg(aiId, {
            content: accumulated, streaming: false,
            responseType: data.responseType, sources: data.context || sources,
            responseTime: data.responseTime, rpaData
          });
          setStatusText('');
          setLoading(false);
        },
        onError: ({ message: errMsg }) => {
          updateMsg(aiId, { content: `⚠️ ${errMsg || 'Something went wrong.'}`, streaming: false, responseType: 'error' });
          setStatusText(''); setLoading(false);
          toast.error('Request failed');
        },
      });
    } catch (err) {
      updateMsg(aiId, { content: `⚠️ ${err.message || 'Connection error. Is the backend running?'}`, streaming: false, responseType: 'error' });
      setStatusText(''); setLoading(false);
      toast.error(err.message || 'Connection error');
    }
  }, [loading, sessionId, sessionStatus, input]);

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  const isLiveAgent = sessionStatus === 'live_agent';

  return (
    <div className="chat-layout">
      <div className="chat-main">

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">
              {isLiveAgent ? '👩‍💼 Live Support' : '💬 Chat'}
            </div>
            <div className="page-subtitle">
              {isLiveAgent
                ? '🟢 Human agent connected — AI is paused'
                : 'AI-powered support · RAG + Agents + RPA'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {statusText && (
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spinner" style={{ width: 12, height: 12 }} />
                {statusText}
              </span>
            )}
            {isLiveAgent && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                Agent Connected
              </span>
            )}
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setMessages([]); setDebugLog(null); toast.success('Chat cleared'); }}>
              🗑 Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="message-welcome">
              <div className="welcome-icon">🤖</div>
              <div className="welcome-title">Welcome to Conversa AI</div>
              <p className="welcome-subtitle">
                Ask questions from the knowledge base, book appointments, capture leads,
                extract data via RPA, or connect with a live agent — all in one chat.
              </p>
              <div className="welcome-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => submit(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`message-row ${msg.role}`}>
              <div className={`avatar avatar-${msg.role === 'user' ? 'user' : 'ai'}`}>
                {msg.role === 'user' ? 'U' : (msg.responseType === 'live_agent' ? '👩‍💼' : '🤖')}
              </div>
              <div className="message-content">
                <div className={`bubble bubble-${msg.role === 'user' ? 'user' : 'ai'}`}>
                  {msg.streaming && msg.content === '' ? <TypingIndicator /> : (
                    msg.role === 'assistant' ? (
                      <div style={{ position: 'relative' }}>
                        <div className="bubble-body">
                          <div className="bubble-text" dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                          {msg.rpaData && (
                            <div style={{ marginTop: 12 }}>
                              <RPABrowser task="RPA Bot is executing automation..." />
                              <RPADataViewer data={msg.rpaData} />
                            </div>
                          )}
                        </div>
                        {!msg.streaming && <VoiceButton text={msg.content} />}
                      </div>
                    ) : msg.content
                  )}
                  {msg.streaming && msg.content !== '' && <span className="cursor-blink">▌</span>}
                </div>

                {/* Metadata */}
                {msg.role === 'assistant' && !msg.streaming && msg.responseType && (
                  <div className="message-meta">
                    <ResponseBadge type={msg.responseType} />
                    {msg.responseTime && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{msg.responseTime}ms</span>}
                  </div>
                )}
                {msg.role === 'assistant' && !msg.streaming && <SourcesPanel sources={msg.sources} />}
              </div>
            </div>
          ))}

          {/* Agent typing indicator */}
          {agentTyping && (
            <div className="message-row assistant">
              <div className="avatar avatar-ai">👩‍💼</div>
              <div className="message-content">
                <div className="bubble bubble-ai"><TypingIndicator /></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          {isLiveAgent && (
            <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginBottom: 10, fontSize: 12.5, color: '#10b981' }}>
              🔒 You are now connected to a live agent. Messages will not go through AI.
            </div>
          )}
          <div className="input-wrapper">
            <button
              id="voice-input-btn"
              className={`btn btn-ghost btn-sm ${isListening ? 'voice-active' : ''}`}
              onClick={toggleVoiceInput}
              title={isListening ? 'Stop recording' : 'Voice input'}
              style={{ padding: '0 12px', minWidth: 40 }}
            >
              {isListening ? '🔴' : '🎙️'}
            </button>
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={isListening ? 'Listening...' : isLiveAgent ? 'Message live agent...' : 'Ask anything... (Shift+Enter for new line)'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={loading}
            />
            <button
              id="send-btn"
              className="send-btn"
              onClick={() => submit(input)}
              disabled={(loading || !input.trim()) && !isListening}
              title="Send (Enter)"
            >
              {loading ? <span className="spinner" /> : '➤'}
            </button>
          </div>
          <div className="input-hint">
            Enter to send · Shift+Enter new line · 🎙️ Voice · Session: {sessionId.slice(0, 8)}
          </div>
        </div>
      </div>

      <DebugPanel 
        log={debugLog} 
        sessionId={sessionId} 
        sessionStatus={sessionStatus} 
        messages={messages} 
      />
    </div>
  );
}
