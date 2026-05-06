import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import UserLayout from './components/UserLayout';
import AdminLayout from './components/AdminLayout';
import AdminGuard from './components/AdminGuard';

// User Pages
import ChatPage from './pages/ChatPage';

// Admin Pages
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import DebugPage from './pages/DebugPage';
import LiveSupportPage from './pages/LiveSupportPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
      }} />
      
      <Routes>
        {/* User Side */}
        <Route path="/chat" element={<UserLayout />}>
          <Route index element={<ChatPage />} />
          <Route path=":sessionId" element={<ChatPage />} />
        </Route>

        {/* Admin Login */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Admin Side (Protected) */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="debug"     element={<DebugPage />} />
          <Route path="support"   element={<LiveSupportPage />} />
        </Route>

        {/* Root Redirects */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
