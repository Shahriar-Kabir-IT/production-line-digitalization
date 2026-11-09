import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePmDashboard, useDevice, useLockDeviceToPm } from '../api/hooks';
import { fmt, pct, facVar, todayStr, prettyDate } from '../lib/format';
import { getDeviceId } from '../lib/device';
import { Loading, StatusPill, useToast } from '../components/ui';
import { FactoryTargetBars, EfficiencyBars, DefectDoughnut } from '../components/charts';
import FitToScreen from '../components/FitToScreen';

const facHex: Record<string, string> = { AGL: '#2563eb', ASL: '#7c3aed', AJL: '#0e9488', ABM: '#db2777' };

export default function PmDashboardPage() {
  const { pmId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [fit, setFit] = useState(() => { try { return localStorage.getItem('mes_fit') !== '0'; } catch { return true; } });
  const q = usePmDashboard(pmId, date);

  function toggleFit() {
    setFit((v) => { const nv = !v; try { localStorage.setItem('mes_fit', nv ? '1' : '0'); } catch {} return nv; });
  }

  const deviceId = useMemo(getDeviceId, []);
  const device = useDevice(deviceId);
  const lockPm = useLockDeviceToPm(deviceId);
  const lockedPmId = device.data?.lockType === 'pm' ? device.data.lockedPmId : null;
  const isLockedHere = lockedPmId === pmId;

  // If this TV is locked to a different PM, force it back to the locked one.
  useEffect(() => {
    if (lockedPmId && pmId && lockedPmId !== pmId) nav(`/pm/${lockedPmId}`, { replace: true });
  }, [lockedPmId, pmId, nav]);

  async function doLock() {
    if (!pmId || !q.data) return;
    try {
      await lockPm.mutateAsync({ pmId, name: q.data.pm.name });
      toast('TV locked to this PM board');
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not lock', 'err');
    }
  }

  if (q.isLoading) return <div className="page tvboard"><Loading /></div>;
  const d = q.data!;
  const col = d.pm.factory ? facHex[d.pm.factory] ?? '#2b57d6' : '#2b57d6';
  const labels = d.lines.map((l) => l.line);
  const pareto = d.byCode.slice(0, 12);
  const effClass = d.totals.avgEff >= d.totals.targetEff * 0.92 ? 'good' : d.totals.avgEff >= d.totals.targetEff * 0.75 ? 'warn' : 'crit';

  return (
    <FitToScreen enabled={fit} designWidth={1520}>
      <div className="tv-head" style={{ ['--tvac' as any]: col }}>
        {!isLockedHere && (
          <button className="btn ghost" onClick={() => nav('/pm')} aria-label="Pick another PM" title="Pick another PM">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        <div className="lbadge" style={{ background: col, fontSize: 20 }}><span><small>PM</small><b>{d.pm.name.replace(/[^0-9]/g, '') || 'PM'}</b></span></div>
        <div>
          <h1>{d.pm.name}</h1>
          <div className="meta">
            <span>{d.pm.factoryName}</span><span>·</span><span><b>{d.pm.lineCount}</b> lines</span><span>·</span>
            <span>{prettyDate(d.date)}</span><span>·</span><span>{d.pm.reporting} reporting</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          {isLockedHere ? (
            <span className="pill" style={{ background: 'var(--brand-050)', color: 'var(--brand)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              Locked · sysadmin to unlock
            </span>
          ) : (
            <button className="btn" onClick={doLock} disabled={lockPm.isPending} title="Lock this TV to this PM board">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              Lock to this PM
            </button>
          )}
          <button className="btn ghost" onClick={toggleFit} title={fit ? 'Fit to screen: on' : 'Fit to screen: off'} aria-label="Toggle fit to screen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{fit ? <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4" /> : <path d="M3 9V5a2 2 0 012-2h4M21 9V5a2 2 0 00-2-2h-4M3 15v4a2 2 0 002 2h4M21 15v4a2 2 0 01-2 2h-4" />}</svg>
          </button>
          <div className="live-badge"><i />LIVE</div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="card kpi" style={{ ['--kpiac' as any]: col }}>
          <div className="label eyebrow">Day Target</div>
          <div className="value tnum">{fmt(d.totals.target)}</div><div className="sub">pcs across my lines</div>
        </div>
        <div className="card kpi accent" style={{ ['--kpiac' as any]: 'var(--brand)' }}>
          <div className="label eyebrow">Achieved</div>
          <div className="value tnum">{fmt(d.totals.achieved)}</div>
          <div className="sub">{pct(d.totals.target ? (d.totals.achieved / d.totals.target) * 100 : 0)} · proj. {fmt(d.totals.projected)}</div>
        </div>
        <div className="card kpi" style={{ ['--kpiac' as any]: `var(--${effClass})` }}>
          <div className="label eyebrow">Avg Efficiency</div>
          <div className="value tnum" style={{ color: `var(--${effClass})` }}>{d.totals.avgEff.toFixed(1)}<small> %</small></div>
          <div className="sub">target {d.totals.targetEff}%</div>
        </div>
        <div className="card kpi" style={{ ['--kpiac' as any]: d.totals.dhu > 7 ? 'var(--crit)' : d.totals.dhu > 4 ? 'var(--warn)' : 'var(--good)' }}>
          <div className="label eyebrow">D.H.U.</div>
          <div className="value tnum">{d.totals.dhu.toFixed(1)}<small> %</small></div><div className="sub">{fmt(d.totals.defects)} defects</div>
        </div>
      </div>

      {d.lines.length === 0 ? (
        <div className="card pad" style={{ textAlign: 'center', padding: 44, marginTop: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 16 }}>No plans set for my lines on this date.</p>
          <p className="muted">Work Study sets the daily plan each morning; this board fills as the day runs.</p>
        </div>
      ) : (
        <div className="pm-grid2">
          <div className="card pad pm-cell">
            <h3 className="ct">Achieved vs. Day Target</h3><div className="cap">Per line, output so far against plan</div>
            <div className="chart-h grow">
              <FactoryTargetBars labels={labels} target={d.lines.map((l) => l.dayTarget)} achieved={d.lines.map((l) => l.achieved)} colors={d.lines.map(() => col)} />
            </div>
          </div>
          <div className="card pad pm-cell">
            <h3 className="ct">Efficiency by Line</h3><div className="cap">Avg efficiency vs. {d.totals.targetEff}% target</div>
            <div className="chart-h grow">
              <EfficiencyBars labels={labels} efficiency={d.lines.map((l) => l.avgEff)} targetEff={d.totals.targetEff} />
            </div>
          </div>
          <div className="card pad pm-cell">
            <h3 className="ct">Defect Breakdown</h3><div className="cap">Across my lines · {fmt(d.totals.defects)} defects · DHU {d.totals.dhu}%</div>
            <div className="chart-h grow">
              {pareto.length > 0 ? <DefectDoughnut labels={pareto.map((c) => c.code)} counts={pareto.map((c) => c.count)} /> : <div className="fullcenter">No defects recorded</div>}
            </div>
          </div>
          <div className="card pad pm-cell">
            <h3 className="ct">My Lines</h3><div className="cap">Tap a line to open its TV board</div>
            <div className="grow pm-lines">
              <table className="data" style={{ minWidth: 440 }}>
                <thead><tr><th>Line</th><th>Buyer</th><th>Target</th><th>Achieved</th><th>Eff %</th><th>DHU %</th><th>Status</th></tr></thead>
                <tbody>
                  {d.lines.map((r) => (
                    <tr key={r.lineId}>
                      <td><span className="rowlink" onClick={() => nav(`/tv/${r.lineId}`)} style={{ fontWeight: 600 }}>{r.line}</span></td>
                      <td className="muted">{r.buyer}</td>
                      <td className="num">{fmt(r.dayTarget)}</td>
                      <td className="num">{fmt(r.achieved)}</td>
                      <td className="num" style={{ color: `var(--${r.status})`, fontWeight: 600 }}>{r.avgEff.toFixed(1)}</td>
                      <td className="num">{r.dhu.toFixed(1)}</td>
                      <td><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </FitToScreen>
  );
}
