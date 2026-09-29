import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AuthenticatedHomePage from '@/pages/AuthenticatedHomePage';
import DriftsPage from '@/pages/DriftsPage';
import DriftDetailPage from '@/pages/DriftDetailPage';
import ClassificationRunPage from '@/pages/ClassificationRunPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useAuth } from '@/lib/auth';

function PublicRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (user) return <Navigate to={new URLSearchParams(location.search).get('next') || '/'} replace />;
  return <Outlet />;
}

function UnknownRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? '/' : `/login?next=${encodeURIComponent(window.location.pathname)}`} replace />;
}

export default function App() {
  return <Routes>
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<AuthenticatedHomePage />} />
        <Route path="/drifts" element={<DriftsPage />} />
        <Route path="/drifts/:driftId" element={<DriftDetailPage />} />
        <Route path="/classification-runs/:runId" element={<ClassificationRunPage />} />
      </Route>
    </Route>
    <Route path="*" element={<UnknownRoute />} />
  </Routes>;
}
