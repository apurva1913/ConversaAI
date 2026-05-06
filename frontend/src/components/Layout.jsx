import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

const NAV = [
  { to: '/chat',      icon: '💬', label: 'Chat' },
  { to: '/knowledge', icon: '📚', label: 'Knowledge Base' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/debug',     icon: '🔍', label: 'Debug Logs' },
];

export default function Layout() {
  const location = useLocation();
  const pageTitle = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Conversa AI';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <div>
            <div className="logo-text">Conversa AI</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className="status-dot" />
            <span>AI System Online</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            GPT-4o-mini · RAG · Agents
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <Outlet />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontSize: '13.5px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </div>
  );
}
