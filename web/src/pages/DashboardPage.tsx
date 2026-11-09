import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOverview, useDefects } from '../api/hooks';
import { fmt, pct, facVar, todayStr, prettyDate } from '../lib/format';
import { Loading } from '../components/ui';
import { FactoryTargetBars, FactoryEffBars, DefectDoughnut } from '../components/charts';
import FitToScreen from '../components/FitToScreen';

const facHex: Record<string, string> = { AGL: '#2563eb', ASL: '#7c3aed', AJL: '#0e9488', ABM: '#db2777' };

export default function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [date, setDate] = useState(todayStr());
  const [fit, setFit] = useState(() => { try { return localStorage.getItem('mes_fit_dash') === '1'; } catch { return false; } });
  function toggleFit() { setFit((v) => { const nv = !v; try { localStorage.setItem('mes_fit_dash', nv ? '1' : '0'); } catch {} return nv; }); }

  const overview = useOverview(date);
  const defects = useDefects(date);

  if (overview.isLoading) return <div className="page"><Loading /></div>;
  const o = overview.data!;
  const isSuper = user?.role === 'SUPER_ADMIN' || user?.role === 'EXECUTIVE';
  const avgTargetEff = o.factories.length ? o.factories.reduce((s, f) => s + f.targetEff, 0) / o.factories.length : 78;
  const pareto = (defects.data?.byCode ?? []).slice(0, 12);
  const rankOrder = [...o.factories].sort((a, b) => b.avgEff - a.avgEff).map((f) => f.factoryId);
  const rankOf = (id: string) => rankOrder.indexOf(id) + 1;

  return (
    <FitToScreen enabled={fit} designWidth={1500} innerClassName="fit-pad" pageClassName="page">
      <div className="page-head">
        <div>
          <h1>{isSuper ? 'Master Dashboard' : `Factory Dashboard · ${user?.factoryCode}`}</h1>
          <div className="sub">{prettyDate(o.date)} · {o.totals.reporting} of {o.totals.lines} lines reporting · {o.totals.factories} {o.totals.factories === 1 ? 'factory' : 'factories'}</div>
        </div>
        <div className="spacer" />
        <div className="field"><label htmlFor="date">Date</label><input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} /></div>
        <button className="btn ghost" onClick={toggleFit} title={fit ? 'Fit to screen: on' : 'Fit to screen: off'} aria-label="Toggle fit to screen" style={{ alignSelf: 'flex-end', height: 38 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{fit ? <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4" /> : <path d="M3 9V5a2 2 0 012-2h4M21 9V5a2 2 0 00-2-2h-4M3 15v4a2 2 0 002 2h4M21 15v4a2 2 0 01-2 2h-4" />}</svg>
        </button>
      </div>

      <div className="summary-strip">
        <div className="si"><b>{o.totals.reporting}</b> of {o.totals.lines} lines live</div>
        <div className="sep" />
        <div className="si">Projected EOD <b>{fmt(o.totals.projected)}</b></div>
        <div className="sep" />
        <div className="si"><b className="tnum" style={{ color: o.totals.target && o.totals.achieved / o.totals.target >= 0.6 ? 'var(--good)' : 'var(--warn)' }}>{pct(o.totals.target ? (o.totals.achieved / o.totals.target) * 100 : 0)}</b> of target so far</div>
        <div className="sep" />
        <div className="si">Total defects <b>{fmt(o.totals.defects)}</b></div>
      </div>

      <div className="kpi-row">
        <div className="card kpi">
          <div className="kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg></div>
          <div className="label eyebrow">Day Target</div>
          <div className="value tnum">{fmt(o.totals.target)}</div><div className="sub">pcs planned today</div>
        </div>
        <div className="card kpi accent">
          <div className="kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l6-6 4 4 7-7" /><path d="M17 7h4v4" /></svg></div>
          <div className="label eyebrow">Achieved so far</div>
          <div className="value tnum">{fmt(o.totals.achieved)}</div>
          <div className="sub">{pct(o.totals.target ? (o.totals.achieved / o.totals.target) * 100 : 0)} · proj. {fmt(o.totals.projected)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14a6 6 0 10-6-6" /><path d="M12 14l4-4" /><path d="M4 20a8 8 0 0116 0" /></svg></div>
          <div className="label eyebrow">Avg Efficiency</div>
          <div className="value tnum">{o.totals.avgEff.toFixed(1)}<small> %</small></div><div className="sub">target {avgTargetEff.toFixed(0)}%</div>
        </div>
        <div className="card kpi">
          <div className="kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg></div>
          <div className="label eyebrow">D.H.U.</div>
          <div className="value tnum">{o.totals.dhu.toFixed(1)}<small> %</small></div><div className="sub">{fmt(o.totals.defects)} defects total</div>
        </div>
      </div>

      <div className="sec-title"><h2>{isSuper ? 'Factories' : 'Factory'}</h2><div className="ln" /></div>
      <div className="fac-grid">
        {o.factories.map((f) => (
          <div key={f.factoryId} className="card fac-card" style={{ ['--facac' as any]: facVar(f.code), cursor: 'default' }}>
            <div className="top">
              <div><div className="fcode"><span className="dot" style={{ background: facVar(f.code) }} />{f.code}{isSuper && <span className="fac-rank">#{rankOf(f.factoryId)}</span>}</div><div className="fname">{f.name}</div></div>
              <span className={`pill ${f.avgEff >= f.targetEff * 0.92 ? 'good' : f.avgEff >= f.targetEff * 0.75 ? 'warn' : 'crit'}`}><i />{f.avgEff.toFixed(0)}%</span>
            </div>
            <div className="big tnum">{fmt(f.achieved)} <small>/ {fmt(f.target)}</small></div>
            <div className="barbg"><div className="barfl" style={{ width: `${Math.min(100, f.pct)}%`, background: facVar(f.code) }} /></div>
            <div className="foot"><span>{f.lineCount} lines</span><span>Eff <b>{f.avgEff.toFixed(1)}%</b></span><span>DHU <b>{f.dhu.toFixed(1)}%</b></span><span>Proj <b>{fmt(f.projected)}</b></span></div>
          </div>
        ))}
      </div>

      <div className="grid-2col" style={{ marginTop: 22 }}>
        <div className="card pad">
          <h3 className="ct">Achieved vs. Day Target</h3><div className="cap">Output so far against today’s plan, by factory</div>
          <div className="chart-h" style={{ height: 260 }}>
            <FactoryTargetBars labels={o.factories.map((f) => f.code)} target={o.factories.map((f) => f.target)} achieved={o.factories.map((f) => f.achieved)} colors={o.factories.map((f) => facHex[f.code])} />
          </div>
        </div>
        <div className="card pad">
          <h3 className="ct">Average Efficiency</h3><div className="cap">By factory vs. target</div>
          <div className="chart-h" style={{ height: 260 }}>
            <FactoryEffBars labels={o.factories.map((f) => f.code)} eff={o.factories.map((f) => f.avgEff)} colors={o.factories.map((f) => facHex[f.code])} targetEff={+avgTargetEff.toFixed(0)} />
          </div>
        </div>
      </div>

      <div className="sec-title"><h2>Defect Analysis</h2><div className="ln" /></div>
      <div className="grid-2col">
        <div className="card pad">
          <h3 className="ct">Defect Breakdown</h3>
          <div className="cap">{defects.data ? `${fmt(defects.data.totals.defects)} defects · ${fmt(defects.data.totals.checked)} checked · DHU ${defects.data.totals.dhu}%` : '…'}</div>
          <div className="chart-h" style={{ height: 250 }}>
            {pareto.length > 0 && <DefectDoughnut labels={pareto.map((d) => d.code)} counts={pareto.map((d) => d.count)} />}
          </div>
        </div>
        <div className="card pad">
          <h3 className="ct">Highest-DHU Lines</h3><div className="cap">Lines with the worst defect rate — act first</div>
          <div className="tablewrap" style={{ border: 0 }}>
            <table className="data" style={{ minWidth: 380 }}>
              <thead><tr><th>Line</th><th>Checked</th><th>Defects</th><th>DHU %</th></tr></thead>
              <tbody>
                {(defects.data?.byLine ?? []).slice(0, 8).map((l) => (
                  <tr key={l.lineId}>
                    <td><span className="linetag"><span className="dot" style={{ background: facVar(l.factory) }} /><span className="rowlink" onClick={() => nav(`/tv/${l.lineId}`)}>{l.factory} · {l.line}</span></span></td>
                    <td className="num">{fmt(l.checked)}</td><td className="num">{l.defects}</td>
                    <td className="num" style={{ color: l.dhu > 7 ? 'var(--crit)' : l.dhu > 4 ? 'var(--warn)' : 'var(--good)', fontWeight: 600 }}>{l.dhu}</td>
                  </tr>
                ))}
                {(!defects.data || defects.data.byLine.length === 0) && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 22, color: 'var(--ink-3)' }}>No defects recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </FitToScreen>
  );
}
