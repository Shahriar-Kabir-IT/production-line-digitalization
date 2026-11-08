import { ReactNode, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LiveClock, ToastProvider, AppFooter, LogoMark } from './ui';
import { useDevice } from '../api/hooks';
import { getDeviceId } from '../lib/device';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const deviceId = useMemo(getDeviceId, []);
  const device = useDevice(deviceId);
  const locked = !!device.data?.locked;
  const path = loc.pathname;

  // Per-page links; none while a device is locked (it can't leave its page).
  const showStation = !locked && path.startsWith('/station');
  const showTv = !locked && path.startsWith('/tv');

  const brandInner = (
    <>
      <LogoMark />
      <div><b>ANANTA · MES</b><span>Manufacturing Execution System</span></div>
    </>
  );

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="topbar">
          {locked ? (
            <div className="brand">{brandInner}</div>
          ) : (
            <Link to="/" className="brand" style={{ color: 'inherit' }}>{brandInner}</Link>
          )}
          <nav className="nav">
            {showStation && (
              <NavLink to="/station" className={({ isActive }) => (isActive ? 'active' : '')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></svg>
                <span>QC Station</span>
              </NavLink>
            )}
            {showTv && (
              <NavLink to="/tv" className={({ isActive }) => (isActive ? 'active' : '')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>
                <span>TV Board</span>
              </NavLink>
            )}
          </nav>
          <div className="topbar-right">
            <LiveClock />
          </div>
        </header>
        <main className="pub-main">{children}</main>
        <AppFooter />
      </div>
    </ToastProvider>
  );
}
