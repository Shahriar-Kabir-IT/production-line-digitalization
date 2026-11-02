import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import type { Status } from '../api/types';
import { statusLabel } from '../lib/format';

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`pill ${status}`}>
      <i />
      {statusLabel[status]}
    </span>
  );
}

export function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <b>{now.toLocaleTimeString('en-GB')}</b>
      <span>{now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
    </div>
  );
}

// ---- toast ----
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; kind: 'ok' | 'err'; show: boolean }>({ msg: '', kind: 'ok', show: false });
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setState({ msg, kind, show: true });
    setTimeout(() => setState((s) => ({ ...s, show: false })), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className={`toast ${state.kind === 'err' ? 'err' : ''} ${state.show ? 'show' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          {state.kind === 'err' ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M5 13l4 4L19 7" />}
        </svg>
        {state.msg}
      </div>
    </ToastCtx.Provider>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="fullcenter" style={{ minHeight: 260 }}>{label}</div>;
}

// Crisp vector mark (Ananta swatch + globe) for small UI like the top bar.
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="brand-mark" role="img" aria-label="Ananta">
      <rect x="5" y="5" width="90" height="90" rx="16" fill="#3f6e94" />
      <g fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeDasharray="3.4 3.4">
        <circle cx="50" cy="50" r="29" />
        <ellipse cx="50" cy="50" rx="11.5" ry="29" />
        <ellipse cx="50" cy="50" rx="29" ry="11.5" />
        <line x1="50" y1="21" x2="50" y2="79" />
        <line x1="21" y1="50" x2="79" y2="50" />
      </g>
    </svg>
  );
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      Copyright © 2026 · Developed and Managed By <b>ANANTA ICT TEAM</b>
    </footer>
  );
}
