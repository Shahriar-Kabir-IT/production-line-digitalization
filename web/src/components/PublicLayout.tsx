import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LiveClock, ToastProvider, AppFooter, LogoMark } from './ui';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <header className="topbar">
        <Link to="/" className="brand" style={{ color: 'inherit' }}>
          <LogoMark />
          <div><b>ANANTA · MES</b><span>Manufacturing Execution System</span></div>
        </Link>
        <nav className="nav">
          <NavLink to="/station" className={({ isActive }) => (isActive ? 'active' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></svg>
            <span>QC Station</span>
          </NavLink>
          <NavLink to="/tv" className={({ isActive }) => (isActive ? 'active' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>
            <span>TV Board</span>
          </NavLink>
        </nav>
        <div className="topbar-right">
          <LiveClock />
          <Link to="/login" className="btn">Admin sign in</Link>
        </div>
      </header>
      <main>{children}</main>
      <AppFooter />
    </ToastProvider>
  );
}
