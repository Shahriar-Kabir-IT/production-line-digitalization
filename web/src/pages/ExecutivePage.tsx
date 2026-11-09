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
const STATUS: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' };
const dhuColor = (d: number) => (d <= 5 ? 'var(--good)' : d <= 10 ? 'var(--warn)' : 'var(--crit)');

function Ring({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
      <div
        style={{
          width: 248, height: 248, borderRadius: '50%',
          background: `conic-gradient(${color} ${v * 3.6}deg, #e7ecf5 0deg)`,
          display: 'grid', placeItems: 'center', position: 'relative',
          boxShadow: `0 20px 45px -18px ${color}66, 0 2px 6px rgba(16,28,51,.06)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 1px 3px rgba(16,28,51,.06)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-.03em' }}>{value.toFixed(0)}<span style={{ fontSize: 26, color: color }}>%</span></div>
            <div style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 8 }}>{label}</div>
          </div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value, accent, delta }: { label: string; value: string; accent?: string; delta?: string }) {
  return (
    <div className="exec-card" style={{ padding: '22px 24px' }}>
      <div style={{ fontSize: 11.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color: accent ?? 'var(--ink)', letterSpacing: '-.02em', marginTop: 8, lineHeight: 1 }}>{value}</div>
      {delta && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 8 }}>{delta}</div>}
    </div>
  );
}

function FactorySlide({ f }: { f: FactoryOverview }) {
  const color = facVar(f.code);
  const es = effStatus(f.avgEff, f.targetEff);
  const effDelta = f.avgEff - f.targetEff;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 52, alignItems: 'center', width: '100%', maxWidth: 1180 }}>
      <Ring value={f.pct} color={color} label="of day target" sub={`${fmt(f.achieved)} / ${fmt(f.target)} pcs`} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 8px 18px -6px ${color}99`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{f.code[0]}</span>
          <h2 style={{ margin: 0, fontSize: 42, color: 'var(--ink)', letterSpacing: '-.02em' }}>{f.code}</h2>
          <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>{f.name}</span>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-2)', marginBottom: 22, marginLeft: 54 }}>{f.reporting} of {f.lineCount} lines reporting today</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
          <Stat label="Achieved" value={fmt(f.achieved)} delta={`Projected ${fmt(f.projected)} by day end`} />
          <Stat label="Avg Efficiency" value={pct(f.avgEff)} accent={STATUS[es]} delta={`${effDelta >= 0 ? '+' : ''}${effDelta.toFixed(1)} vs ${pct(f.targetEff)} target`} />
          <Stat label="Day Target" value={fmt(f.target)} delta={`${pct(f.pct)} achieved so far`} />
          <Stat label="DHU (Quality)" value={pct(f.dhu)} accent={dhuColor(f.dhu)} delta="Defects per hundred units" />
        </div>
      </div>
    </div>
  );
}

function GroupSlide({ o, order }: { o: Overview; order: FactoryOverview[] }) {
  const t = o.totals;
  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <div style={{ fontSize: 12.5, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--brand)', fontWeight: 700 }}>Group Performance · Today</div>
        <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.04, marginTop: 8 }}>
          <span style={{ background: 'linear-gradient(135deg, var(--brand), #4f7cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{fmt(t.achieved)}</span>
          <span style={{ fontSize: 28, color: 'var(--ink-3)', fontWeight: 700 }}> pcs produced</span>
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 10 }}>
          {t.reporting} of {t.lines} lines live&nbsp;·&nbsp;Avg efficiency <b style={{ color: 'var(--ink)' }}>{pct(t.avgEff)}</b>&nbsp;·&nbsp;DHU <b style={{ color: 'var(--ink)' }}>{pct(t.dhu)}</b>&nbsp;·&nbsp;Projected <b style={{ color: 'var(--ink)' }}>{fmt(t.projected)}</b> by day end
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        {order.map((f) => {
          const color = facVar(f.code);
          return (
            <div key={f.factoryId} className="exec-card" style={{ padding: 22, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
                <span style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>{f.code}</span>
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--ink)', marginTop: 16, letterSpacing: '-.02em', lineHeight: 1 }}>{f.pct.toFixed(0)}<span style={{ fontSize: 18, color }}>%</span></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>of target · {fmt(f.achieved)} pcs</div>
              <div style={{ height: 8, background: '#eef1f7', borderRadius: 5, overflow: 'hidden', margin: '14px 0' }}>
                <div style={{ width: `${Math.min(100, f.pct)}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>Eff <b style={{ color: 'var(--ink)' }}>{pct(f.avgEff)}</b></span><span>DHU <b style={{ color: dhuColor(f.dhu) }}>{pct(f.dhu)}</b></span>
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

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, paused, count]);

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
        .exec-root{position:fixed;inset:0;background:radial-gradient(1100px 620px at 72% -12%,#eaf1ff 0%,#f4f7fd 52%,#eef1f7 100%);color:var(--ink);display:flex;flex-direction:column;overflow:hidden;z-index:40;}
        .exec-card{background:#fff;border:1px solid rgba(16,28,51,.07);border-radius:20px;box-shadow:0 14px 34px -18px rgba(22,43,92,.22),0 2px 6px rgba(16,28,51,.04);}
        .exec-prog{height:4px;background:rgba(16,28,51,.07);}
        .exec-prog > i{display:block;height:100%;background:linear-gradient(90deg,var(--brand),#5b86ff);}
        .exec-prog.run > i{animation:execfill ${SLIDE_MS}ms linear forwards;}
        @keyframes execfill{from{width:0}to{width:100%}}
        .exec-stage{flex:1;display:grid;place-items:center;padding:20px 40px;animation:execin .55s cubic-bezier(.2,.7,.3,1);}
        @keyframes execin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .exec-btn{background:#fff;border:1px solid rgba(16,28,51,.1);color:var(--ink);border-radius:10px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:var(--shadow-sm);}
        .exec-btn:hover{border-color:var(--brand);color:var(--brand);}
        .exec-btn.primary{background:var(--brand);color:#fff;border-color:var(--brand);}
        .exec-topbar{display:flex;align-items:center;gap:14px;padding:16px 24px;background:rgba(255,255,255,.72);backdrop-filter:blur(8px);border-bottom:1px solid rgba(16,28,51,.06);}
        .exec-dot{width:9px;height:9px;border-radius:50%;background:rgba(16,28,51,.16);cursor:pointer;border:none;padding:0;transition:all .2s;}
        .exec-dot.on{background:var(--brand);width:28px;border-radius:5px;}
        @media (max-width:900px){.exec-stage > div{grid-template-columns:1fr !important;gap:26px !important;}}
      `}</style>

      <div key={idx} className={`exec-prog ${paused ? '' : 'run'}`}><i /></div>

      <div className="exec-topbar">
        <LogoMark size={32} />
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.01em' }}>Executive Overview</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{prettyDate(overview.data!.date)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ color: 'var(--ink-2)' }}><LiveClock /></div>
        <button className="exec-btn" onClick={() => setPaused((p) => !p)}>{paused ? '▶ Play' : '❚❚ Pause'}</button>
        <button className="exec-btn primary" onClick={() => nav('/dashboard')}>View details →</button>
        <FullscreenButton className="exec-btn" />
        <button className="exec-btn" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
      </div>

      <div className="exec-stage" key={`s${idx}`}>
        {slide.kind === 'group' ? <GroupSlide o={overview.data!} order={order} /> : <FactorySlide f={slide.f} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 24px 24px', position: 'relative' }}>
        <button className="exec-btn" onClick={() => go(idx - 1)} aria-label="Previous">←</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {slides.map((s, i) => (
            <button key={i} className={`exec-dot ${i === idx ? 'on' : ''}`} aria-label={s.kind === 'group' ? 'Group' : s.f.code} onClick={() => go(i)} />
          ))}
        </div>
        <button className="exec-btn" onClick={() => go(idx + 1)} aria-label="Next">→</button>
        <div style={{ position: 'absolute', right: 28, fontSize: 12.5, color: 'var(--ink-3)' }}>
          {slide.kind === 'group' ? 'Group' : slide.f.code} · {idx + 1}/{count}{user ? ` · ${user.name}` : ''}
        </div>
      </div>
    </div>
  );
}
