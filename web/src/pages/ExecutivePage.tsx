import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOverview } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import type { FactoryOverview, Overview } from '../api/types';
import { fmt, pct, prettyDate, todayStr, facVar } from '../lib/format';
import { FullscreenButton, LiveClock, LogoMark, Loading } from '../components/ui';

const SLIDE_MS = 13000;
const FACTORY_ORDER = ['AGL', 'ASL', 'AJL', 'ABM'];

type Slide = { kind: 'group' } | { kind: 'factory'; f: FactoryOverview };

function effStatus(eff: number, target: number): 'good' | 'warn' | 'crit' {
  if (target <= 0) return 'warn';
  const r = eff / target;
  if (r >= 0.95) return 'good';
  if (r >= 0.8) return 'warn';
  return 'crit';
}
const STATUS_COLOR: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' };

function Ring({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 230, height: 230, borderRadius: '50%',
          background: `conic-gradient(${color} ${v * 3.6}deg, rgba(255,255,255,.10) 0deg)`,
          display: 'grid', placeItems: 'center', position: 'relative',
          boxShadow: `0 0 50px -12px ${color}`,
        }}
      >
        <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', background: '#0e1726', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: '#fff', letterSpacing: '-.02em' }}>{value.toFixed(0)}<span style={{ fontSize: 26, opacity: .7 }}>%</span></div>
            <div style={{ fontSize: 12.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginTop: 6 }}>{label}</div>
          </div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value, accent, delta }: { label: string; value: string; accent?: string; delta?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
      <div style={{ fontSize: 12.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{label}</div>
      <div style={{ fontSize: 42, fontWeight: 800, color: accent ?? '#fff', letterSpacing: '-.02em', marginTop: 8, lineHeight: 1 }}>{value}</div>
      {delta && <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.55)', marginTop: 6 }}>{delta}</div>}
    </div>
  );
}

function FactorySlide({ f }: { f: FactoryOverview }) {
  const color = facVar(f.code);
  const es = effStatus(f.avgEff, f.targetEff);
  const effDelta = f.avgEff - f.targetEff;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 48, alignItems: 'center', width: '100%', maxWidth: 1180 }}>
      <Ring value={f.pct} color={color} label="of day target" sub={`${fmt(f.achieved)} / ${fmt(f.target)} pcs`} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: 5, background: color, boxShadow: `0 0 18px ${color}` }} />
          <h2 style={{ margin: 0, fontSize: 40, color: '#fff', letterSpacing: '-.02em' }}>{f.code}</h2>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,.55)' }}>{f.name}</span>
        </div>
        <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.5)', marginBottom: 22 }}>{f.reporting} of {f.lineCount} lines reporting today</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
          <Stat label="Achieved" value={fmt(f.achieved)} delta={`Projected ${fmt(f.projected)} by day end`} />
          <Stat label="Avg Efficiency" value={pct(f.avgEff)} accent={STATUS_COLOR[es]} delta={`${effDelta >= 0 ? '+' : ''}${effDelta.toFixed(1)} vs ${pct(f.targetEff)} target`} />
          <Stat label="Day Target" value={fmt(f.target)} delta={`${pct(f.pct)} achieved so far`} />
          <Stat label="DHU (Quality)" value={pct(f.dhu)} accent={f.dhu <= 5 ? 'var(--good)' : f.dhu <= 10 ? 'var(--warn)' : 'var(--crit)'} delta="Defects per hundred units" />
        </div>
      </div>
    </div>
  );
}

function GroupSlide({ o, order }: { o: Overview; order: FactoryOverview[] }) {
  const t = o.totals;
  return (
    <div style={{ width: '100%', maxWidth: 1180 }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>Group Performance · Today</div>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', lineHeight: 1.05, marginTop: 6 }}>
          {fmt(t.achieved)} <span style={{ fontSize: 28, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>pcs produced</span>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,.6)', marginTop: 8 }}>
          {t.reporting} of {t.lines} lines live · Avg efficiency {pct(t.avgEff)} · DHU {pct(t.dhu)} · Projected {fmt(t.projected)} by day end
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {order.map((f) => {
          const color = facVar(f.code);
          return (
            <div key={f.factoryId} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 20, borderTop: `3px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: color }} />
                <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{f.code}</span>
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#fff', marginTop: 14, letterSpacing: '-.02em', lineHeight: 1 }}>{f.pct.toFixed(0)}<span style={{ fontSize: 18, opacity: .6 }}>%</span></div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>of target</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 4, overflow: 'hidden', margin: '12px 0' }}>
                <div style={{ width: `${Math.min(100, f.pct)}%`, height: '100%', background: color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                <span>Eff {pct(f.avgEff)}</span><span>DHU {pct(f.dhu)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExecutivePage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const overview = useOverview(todayStr());
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const order = useMemo(() => {
    const fs = overview.data?.factories ?? [];
    return [...fs].sort((a, b) => {
      const ia = FACTORY_ORDER.indexOf(a.code); const ib = FACTORY_ORDER.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [overview.data]);

  const slides: Slide[] = useMemo(() => [{ kind: 'group' }, ...order.map((f) => ({ kind: 'factory' as const, f }))], [order]);
  const count = slides.length;

  // auto-advance
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, paused, count]);

  // keyboard control (handy on a TV remote / presenter)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % count);
      else if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + count) % count);
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  useEffect(() => { if (idx >= count) setIdx(0); }, [count, idx]);

  if (overview.isLoading) return <div className="exec-root" style={{ display: 'grid', placeItems: 'center' }}><Loading label="Loading executive overview…" /></div>;

  const slide = slides[Math.min(idx, count - 1)];
  const go = (n: number) => setIdx(((n % count) + count) % count);

  return (
    <div className="exec-root">
      <style>{`
        .exec-root{position:fixed;inset:0;background:radial-gradient(1200px 700px at 70% -10%,#1b2a49 0%,#0c1424 55%,#080d18 100%);color:#fff;display:flex;flex-direction:column;overflow:hidden;z-index:40;}
        .exec-prog{height:4px;background:rgba(255,255,255,.08);}
        .exec-prog > i{display:block;height:100%;background:linear-gradient(90deg,#4f7cff,#8ab4ff);}
        .exec-prog.run > i{animation:execfill ${SLIDE_MS}ms linear forwards;}
        @keyframes execfill{from{width:0}to{width:100%}}
        .exec-stage{flex:1;display:grid;place-items:center;padding:24px 40px;animation:execin .6s ease;}
        @keyframes execin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .exec-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
        .exec-btn:hover{background:rgba(255,255,255,.16);}
        .exec-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;border:none;padding:0;}
        .exec-dot.on{background:#8ab4ff;width:26px;border-radius:5px;}
        @media (max-width:900px){.exec-stage > div{grid-template-columns:1fr !important;gap:24px !important;}}
      `}</style>

      {/* progress bar */}
      <div key={idx} className={`exec-prog ${paused ? '' : 'run'}`}><i /></div>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px' }}>
        <LogoMark size={30} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Executive Overview</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{prettyDate(overview.data!.date)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ color: 'rgba(255,255,255,.8)' }}><LiveClock /></div>
        <button className="exec-btn" onClick={() => setPaused((p) => !p)}>{paused ? '▶ Play' : '⏸ Pause'}</button>
        <button className="exec-btn" onClick={() => nav('/dashboard')}>View details →</button>
        <FullscreenButton className="exec-btn" />
        <button className="exec-btn" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
      </div>

      {/* stage */}
      <div className="exec-stage" key={`s${idx}`}>
        {slide.kind === 'group' ? <GroupSlide o={overview.data!} order={order} /> : <FactorySlide f={slide.f} />}
      </div>

      {/* footer nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '16px 24px 24px' }}>
        <button className="exec-btn" onClick={() => go(idx - 1)}>←</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {slides.map((s, i) => (
            <button key={i} className={`exec-dot ${i === idx ? 'on' : ''}`} aria-label={s.kind === 'group' ? 'Group' : s.f.code} onClick={() => go(i)} />
          ))}
        </div>
        <button className="exec-btn" onClick={() => go(idx + 1)}>→</button>
        <div style={{ position: 'absolute', right: 28, fontSize: 12.5, color: 'rgba(255,255,255,.4)' }}>
          {slide.kind === 'group' ? 'Group' : slide.f.code} · {idx + 1}/{count}{user ? ` · ${user.name}` : ''}
        </div>
      </div>
    </div>
  );
}
