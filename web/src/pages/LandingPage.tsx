import { useNavigate } from 'react-router-dom';
import { AppFooter, LogoMark } from '../components/ui';

const cards = [
  {
    to: '/station', title: 'QC Station', accent: '#387090', tag: 'Line PC',
    desc: 'Pick your line and tally checked pieces and defects for the current hour.',
    icon: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></>,
  },
  {
    to: '/tv', title: 'Line TV Board', accent: '#0e9488', tag: 'Big screen',
    desc: 'Pick a line to display Target vs Achieved and live efficiency on a mounted TV.',
    icon: <><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></>,
  },
  {
    to: '/pm', title: 'PM Board', accent: '#db2777', tag: 'Big screen',
    desc: 'Pick a Production Manager to show all their lines’ performance on the TV.',
    icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  },
  {
    to: '/login', title: 'Work Study / Admin', accent: '#1e4a60', tag: 'Sign in',
    desc: 'Set the daily line plan, or view factory and master dashboards.',
    icon: <><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>,
  },
];

export default function LandingPage() {
  const nav = useNavigate();
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <LogoMark />
          <div><b>ANANTA · MES</b><span>Manufacturing Execution System</span></div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="lh-glow" aria-hidden="true" />
        <img src="/ananta-logo.png" alt="Ananta" className="lh-logo" />
        <div className="l2-eyebrow" style={{ color: 'rgba(255,255,255,0.72)' }}>Ananta · MES</div>
        <h1>Manufacturing Execution System</h1>
        <p>Real-time production &amp; quality monitoring for Ananta Garments, Sportswear, Jeanswear &amp; ABM Fashion.</p>
      </section>

      <main className="landing-body">
        <div className="lb-head">
          <h2>Where do you want to go?</h2>
          <p className="muted">Choose how you’ll use the system on this device.</p>
        </div>
        <div className="landing-grid">
          {cards.map((c) => (
            <button key={c.to} className="card landing-card" onClick={() => nav(c.to)} style={{ ['--ac' as any]: c.accent }}>
              <div className="lc-top">
                <div className="lc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{c.icon}</svg></div>
                <span className="lc-tag">{c.tag}</span>
              </div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <span className="lc-go">Open <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
            </button>
          ))}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
