import { Navigate, useLocation } from 'react-router-dom';

export default function AdminGuard({ children }) {
  const isAuth = localStorage.getItem('admin_auth') === 'true';
  const location = useLocation();

  if (!isAuth) {
    // Redirect to login but save the current location to return to after login
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
