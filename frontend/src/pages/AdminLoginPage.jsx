import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simple demo auth - for a production app use real backend auth
    setTimeout(() => {
      if (password === 'admin123') { // Demo credential
        localStorage.setItem('admin_auth', 'true');
        toast.success('Access Granted. Welcome back, Admin.');
        const from = location.state?.from?.pathname || '/admin/dashboard';
        navigate(from, { replace: true });
      } else {
        toast.error('Invalid credentials. Access denied.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a12 100%)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 40, boxShadow: 'var(--shadow-lg)',
        animation: 'fadeSlideIn 0.5s ease'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            width: 64, height: 64, background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
            borderRadius: 18, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: 'var(--shadow-accent)'
          }}>
            🛡️
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Admin Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            Restricted area. Please authenticate.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
              Admin Password
            </label>
            <input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--text-primary)',
                fontSize: 15, outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ height: 48, justifyContent: 'center', fontSize: 16 }}
            disabled={loading || !password}
          >
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Tip: Pass is <code>admin123</code> for demo
        </div>
      </div>
    </div>
  );
}
