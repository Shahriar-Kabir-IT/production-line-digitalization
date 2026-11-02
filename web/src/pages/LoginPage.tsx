import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { label: 'Super Admin', sub: 'all factories', username: 'admin' },
  { label: 'Work Study', sub: 'AGL factory', username: 'ws.agl' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login2">
      <aside className="login2-brand">
        <div className="l2-glow" aria-hidden="true" />
        <div className="l2-brandtop">
          <img src="/ananta-logo.png" alt="Ananta" className="l2-logo" />
        </div>
        <div className="l2-copy">
          <div className="l2-eyebrow">Ananta · MES</div>
          <h1>Manufacturing<br />Execution System</h1>
        </div>
        <div className="l2-tag">Making a world of fashion</div>
      </aside>

      <main className="login2-main">
        <div className="login2-card">
          <img src="/ananta-logo.png" alt="Ananta" className="login2-logo-sm" />
          <div className="l2-eyebrow">Ananta MES</div>
          <h2>Welcome back</h2>
          <p className="login2-sub">Sign in to your Work Study or Admin account.</p>

          <form onSubmit={submit}>
            {err && <div className="login-err">{err}</div>}
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="u">Username</label>
              <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="pw">Password</label>
              <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 46, fontSize: 15 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="l2-demo">
            <span className="l2-demo-label">Demo accounts · password <code>password</code></span>
            <div className="l2-demo-row">
              {DEMO.map((d) => (
                <button key={d.username} type="button" className="l2-demo-btn" onClick={() => { setUsername(d.username); setPassword('password'); }}>
                  <b>{d.label}</b><span>{d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <Link to="/" className="l2-back">← Line station &amp; TV board (no sign-in)</Link>
        </div>
        <footer className="app-footer">Copyright © 2026 · Developed and Managed By <b>ANANTA ICT TEAM</b></footer>
      </main>
    </div>
  );
}
