import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LiveClock, ToastProvider, AppFooter, LogoMark } from './ui';
import type { Role } from '../api/types';

const roleName: Record<Role, string> = { SUPER_ADMIN: 'Super Admin', WORK_STUDY: 'Work Study', LINE_WORKER: 'Line Worker', SYS_ADMIN: 'System Admin', PRODUCTION_MANAGER: 'Production Manager' };

const icons = {
  dash: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  plan: <><path d="M9 3v4M15 3v4M4 8h16M5 8v12a1 1 0 001 1h12a1 1 0 001-1V8" /><path d="M8 13h3M8 17h5" /></>,
  tv: <><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></>,
  device: <><rect x="4" y="3" width="16" height="12" rx="2" /><path d="M8 21h8M12 15v6" /><rect x="9" y="7" width="6" height="4" rx="1" /></>,
};

function navFor(role: Role) {
  if (role === 'SYS_ADMIN') return [{ to: '/sysadmin', label: 'Devices', icon: icons.device }];
  return [
    { to: '/dashboard', label: 'Dashboard', icon: icons.dash },
    { to: '/plan', label: 'Plan Entry', icon: icons.plan },
  ];
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const scope = user.role === 'SUPER_ADMIN' ? 'All factories' : user.role === 'SYS_ADMIN' ? 'System' : user.factoryCode || '';

  return (
    <ToastProvider>
      <header className="topbar">
        <div className="brand">
          <LogoMark />
          <div>
            <b>ANANTA · MES</b>
            <span>Manufacturing Execution System</span>
          </div>
        </div>
        <nav className="nav">
          {navFor(user.role).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.icon}</svg>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <LiveClock />
          <div className="usermenu">
            <div className="who">
              <b>{user.name}</b>
              <span>{roleName[user.role]} · {scope}</span>
            </div>
            <div className="avatar">{initials}</div>
            <button className="btn ghost" onClick={logout} title="Sign out" aria-label="Sign out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /></svg>
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <AppFooter />
    </ToastProvider>
  );
}
