import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { useDevice } from './api/hooks';
import { getDeviceId } from './lib/device';
import type { Role } from './api/types';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LinesPage from './pages/LinesPage';
import WorkStudyPage from './pages/WorkStudyPage';
import StationPage from './pages/StationPage';
import TVSelectPage from './pages/TVSelectPage';
import LineTVPage from './pages/LineTVPage';
import SysAdminPage from './pages/SysAdminPage';
import PmDashboardPage from './pages/PmDashboardPage';
import PmSelectPage from './pages/PmSelectPage';

export function homePath(role: Role): string {
  if (role === 'SYS_ADMIN') return '/sysadmin';
  if (role === 'PRODUCTION_MANAGER') return '/pm';
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

// A locked device (QC station → a line, or a PM-board TV → a PM) cannot leave its
// page. Any other route is sent back to the locked page until a sysadmin unlocks.
function LockGuard() {
  const deviceId = useMemo(getDeviceId, []);
  const device = useDevice(deviceId);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    const d = device.data;
    if (!d?.locked) return;
    if (d.lockType === 'line' && loc.pathname !== '/station') nav('/station', { replace: true });
    else if (d.lockType === 'pm' && d.lockedPmId && loc.pathname !== `/pm/${d.lockedPmId}`) nav(`/pm/${d.lockedPmId}`, { replace: true });
  }, [device.data, loc.pathname, nav]);
  return null;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <>
      <LockGuard />
      <Routes>
      {/* public kiosk */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/station" element={pub(<StationPage />)} />
      <Route path="/tv" element={pub(<TVSelectPage />)} />
      <Route path="/tv/:lineId" element={pub(<LineTVPage />)} />
      <Route path="/pm" element={pub(<PmSelectPage />)} />
      <Route path="/pm/:pmId" element={pub(<PmDashboardPage />)} />

      {/* auth */}
      <Route path="/login" element={user ? <Navigate to={homePath(user.role)} replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<Protected roles={['SUPER_ADMIN', 'WORK_STUDY']}><DashboardPage /></Protected>} />
      <Route path="/lines" element={<Protected roles={['SUPER_ADMIN', 'WORK_STUDY']}><LinesPage /></Protected>} />
      <Route path="/plan" element={<Protected roles={['SUPER_ADMIN', 'WORK_STUDY']}><WorkStudyPage /></Protected>} />
      <Route path="/sysadmin" element={<Protected roles={['SYS_ADMIN']}><SysAdminPage /></Protected>} />

      <Route path="*" element={loading ? <div className="fullcenter">Loading…</div> : <Navigate to={user ? homePath(user.role) : '/'} replace />} />
      </Routes>
    </>
  );
}
