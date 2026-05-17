import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

// ── ProtectedRoute: redirect to /login if not authenticated ───────────────────
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d1f]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ── RoleGuard: renders children only if user has required role ────────────────
export function RoleGuard({ roles, children, fallback = null }) {
  const { user } = useAuth();

  if (!user) return fallback;

  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) return fallback;

  return children;
}
