import { Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import type { Role } from './api/types';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkStudyPage from './pages/WorkStudyPage';
import StationPage from './pages/StationPage';
import TVSelectPage from './pages/TVSelectPage';
import LineTVPage from './pages/LineTVPage';

export function homePath(_role: Role): string {
  return '/dashboard';
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="fullcenter">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <Layout>{children}</Layout>;
}

const pub = (node: ReactNode) => <PublicLayout>{node}</PublicLayout>;

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      {/* public kiosk */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/station" element={pub(<StationPage />)} />
      <Route path="/tv" element={pub(<TVSelectPage />)} />
      <Route path="/tv/:lineId" element={pub(<LineTVPage />)} />

      {/* auth */}
      <Route path="/login" element={user ? <Navigate to={homePath(user.role)} replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<Protected roles={['SUPER_ADMIN', 'WORK_STUDY']}><DashboardPage /></Protected>} />
      <Route path="/plan" element={<Protected roles={['SUPER_ADMIN', 'WORK_STUDY']}><WorkStudyPage /></Protected>} />

      <Route path="*" element={loading ? <div className="fullcenter">Loading…</div> : <Navigate to={user ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
