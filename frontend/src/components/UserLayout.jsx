import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams, Link } from 'react-router-dom';
import { getSessions } from '../api/client';
import { v4 as uuidv4 } from 'uuid';

export default function UserLayout() {
  const [sessions, setSessions] = useState([]);
  const { sessionId: currentSessionId } = useParams();
  const navigate = useNavigate();

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Poll for new sessions
    return () => clearInterval(interval);
  }, []);

  const handleNewChat = () => {
    const newId = uuidv4();
    navigate(`/chat/${newId}`);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar user-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-spark">✨</span> Conversations
          </div>
          <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={handleNewChat}>
            + New Chat
          </button>
        </div>

        <div className="sidebar-nav">
          <div className="sidebar-label">Recent History</div>
          {sessions.length === 0 ? (
            <div style={{ padding: '0 12px', fontSize: 12, color: 'var(--text-muted)' }}>No previous chats</div>
          ) : (
            sessions.map(s => (
              <Link
                key={s.sessionId}
                to={`/chat/${s.sessionId}`}
                className={`sidebar-item ${currentSessionId === s.sessionId ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span>💬</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name || 'Untitled Chat'}
                  </span>
                </div>
                {s.status === 'live_agent' && <span className="badge-live-dot" title="Live Agent Active" />}
              </Link>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', opacity: 0.6 }}>
            Premium Multi-Agent Support
          </div>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
