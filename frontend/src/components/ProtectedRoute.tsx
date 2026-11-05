import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { PageLoader } from './ui';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
