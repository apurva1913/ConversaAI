import { NavLink, Outlet, Link } from 'react-router-dom';

const ADMIN_NAV = [
  { path: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/admin/knowledge', icon: '📚', label: 'Knowledge Base' },
  { path: '/admin/support',   icon: '🎧', label: 'Live Support' },
  { path: '/admin/debug',     icon: '🔍', label: 'Debug Logs' },
];

export default function AdminLayout() {
  return (
    <div className="layout-root">
      <aside className="sidebar admin-sidebar" style={{ borderRightColor: 'var(--accent-glow)' }}>
        <div className="sidebar-header">
          <div className="sidebar-logo admin-logo">
            <span className="logo-spark" style={{ filter: 'hue-rotate(90deg)' }}>🛡️</span> Conversa Admin
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Platform Control</div>
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active admin-active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/chat" className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
            💬 Customer View
          </Link>
          <div className="system-status">
            <span className="status-dot online" /> <span>Connected to Weaviate</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
