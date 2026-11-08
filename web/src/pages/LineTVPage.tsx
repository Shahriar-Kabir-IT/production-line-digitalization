import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBoard } from '../api/hooks';
import { socket } from '../lib/socket';
import { fmt, facVar } from '../lib/format';
import { Loading, StatusPill } from '../components/ui';
import Gauge from '../components/Gauge';
import { TargetAchievedChart, EfficiencyBars } from '../components/charts';
import FitToScreen from '../components/FitToScreen';
import type { Board } from '../api/types';

const facHex: Record<string, string> = { AGL: '#2563eb', ASL: '#7c3aed', AJL: '#0e9488', ABM: '#db2777' };

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

export default function LineTVPage() {
  const { lineId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const board = useBoard(lineId);
  const [fit, setFit] = useState(() => { try { return localStorage.getItem('mes_fit') !== '0'; } catch { return true; } });
  function toggleFit() { setFit((v) => { const nv = !v; try { localStorage.setItem('mes_fit', nv ? '1' : '0'); } catch {} return nv; }); }

  useEffect(() => {
    if (!lineId) return;
    socket.emit('join:line', lineId);
    const onUpdate = (payload: Board) => {
      if (payload?.lineId === lineId) qc.setQueryData(['board', lineId, 'today'], payload);
      else qc.invalidateQueries({ queryKey: ['board', lineId] });
    };
    socket.on('line:update', onUpdate);
    return () => { socket.emit('leave:line', lineId); socket.off('line:update', onUpdate); };
  }, [lineId, qc]);

  if (board.isLoading) return <div className="page"><Loading /></div>;
  const b = board.data!;
  const plan = b.plan;
  const m = b.metrics;
  const col = facHex[b.factory] || '#2b57d6';

  return (
    <FitToScreen enabled={fit} designWidth={1400}>
      <div className="tv-head" style={{ ['--tvac' as any]: col }}>
        <button className="btn ghost" onClick={() => nav('/tv')} aria-label="Back to line list" title="Pick another line">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="lbadge" style={{ background: facVar(b.factory) }}><span><small>LINE</small><b>{b.line.replace('New-', 'N')}</b></span></div>
        <div>
          <h1>{b.factory} · Line {b.line}</h1>
          <div className="meta">
            {m && <StatusPill status={m.status} />}
            {plan ? <><span>Buyer <b>{plan.buyer}</b></span><span>·</span><span>Style <b>{plan.style}</b></span><span>·</span><span>SMV <b>{plan.smv}</b></span><span>·</span><span>M/P <b>{plan.manpower}</b></span></> : <span className="muted">No plan set for today</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn ghost" onClick={toggleFit} title={fit ? 'Fit to screen: on' : 'Fit to screen: off'} aria-label="Toggle fit to screen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{fit ? <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4" /> : <path d="M3 9V5a2 2 0 012-2h4M21 9V5a2 2 0 00-2-2h-4M3 15v4a2 2 0 002 2h4M21 15v4a2 2 0 01-2 2h-4" />}</svg>
          </button>
          <button className="btn ghost" onClick={toggleFullscreen} title="Fullscreen" aria-label="Fullscreen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" /></svg>
          </button>
          <div className="live-badge"><i />LIVE</div>
        </div>
      </div>

      {!plan || !m ? (
        <div className="card pad" style={{ textAlign: 'center', padding: 44 }}>
          <p style={{ fontWeight: 600, fontSize: 16 }}>No data yet for this line today.</p>
          <p className="muted">Once Work Study sets the plan and the QC station enters checks, this board goes live.</p>
        </div>
      ) : (
        <div className="tv-grid">
          <div className="kpi-row">
            <div className="card kpi" style={{ ['--kpiac' as any]: col }}>
              <div className="label eyebrow"><span className="dot" style={{ background: facVar(b.factory) }} />Day Target</div>
              <div className="value tnum">{fmt(plan.dayTarget)}</div><div className="sub">pcs · plan for today</div>
            </div>
            <div className="card kpi accent" style={{ ['--kpiac' as any]: 'var(--brand)' }}>
              <div className="label eyebrow">Achieved</div>
              <div className="value tnum">{fmt(m.achieved)}</div>
              <div className="sub">{m.workedHours} of {plan.plannedHours} hrs · proj. {fmt(m.projected)}</div>
            </div>
            <div className="card kpi" style={{ ['--kpiac' as any]: `var(--${m.status})` }}>
              <div className="label eyebrow">Avg Efficiency</div>
              <div className="value tnum" style={{ color: `var(--${m.status})` }}>{m.avgEff.toFixed(1)}<small> %</small></div>
              <div className="sub">target {m.targetEff}%</div>
            </div>
            <div className="card kpi" style={{ ['--kpiac' as any]: m.dhu > 7 ? 'var(--crit)' : m.dhu > 4 ? 'var(--warn)' : 'var(--good)' }}>
              <div className="label eyebrow">D.H.U.</div>
              <div className="value tnum">{m.dhu.toFixed(1)}<small> %</small></div>
              <div className="sub">{fmt(m.totalDefects)} defects / {fmt(m.totalChecked)} checked</div>
            </div>
          </div>

          <div className="card pad">
            <h3 className="ct">Target Against Achieved</h3>
            <div className="cap">Cumulative checked vs. required pace — {fmt(plan.dayTarget)} pcs by hour {plan.plannedHours}</div>
            <div className="chart-h" style={{ height: 340 }}>
              <TargetAchievedChart labels={m.series.labels} pace={m.series.pace} cumulative={m.series.cumulative} color={col} suggestedMax={Math.max(plan.dayTarget, m.projected)} />
            </div>
          </div>

          <div className="card pad">
            <h3 className="ct">Current Line Average Efficiency</h3>
            <div className="cap">Live gauge &amp; hour-by-hour efficiency vs. the {m.targetEff}% target line</div>
            <div className="gaugewrap">
              <div className="gauge"><Gauge value={m.avgEff} targetEff={m.targetEff} status={m.status} /></div>
              <div className="efflegend">
                <div className="row"><span className="k">Current avg</span><span className="v" style={{ color: `var(--${m.status})` }}>{m.avgEff.toFixed(1)}%</span></div>
                <div className="row"><span className="k">Best hour</span><span className="v">{m.bestHourEff.toFixed(1)}%</span></div>
                <div className="row"><span className="k">Pace vs plan</span><span className="v">{m.pctOfPace.toFixed(0)}%</span></div>
              </div>
            </div>
            <div className="chart-h" style={{ height: 168, marginTop: 8 }}>
              <EfficiencyBars labels={m.series.labels} efficiency={m.series.efficiency} targetEff={m.targetEff} />
            </div>
          </div>
        </div>
      )}
    </FitToScreen>
  );
}
