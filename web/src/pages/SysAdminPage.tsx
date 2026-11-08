import { useState } from 'react';
import { useSysOverview, useSysDevices, useSysDeviceAction, usePublicFactories } from '../api/hooks';
import { fmt } from '../lib/format';
import { Loading, useToast } from '../components/ui';

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SysAdminPage() {
  const toast = useToast();
  const overview = useSysOverview();
  const devices = useSysDevices();
  const factories = usePublicFactories();
  const act = useSysDeviceAction();
  const [pick, setPick] = useState<Record<string, string>>({});

  if (overview.isLoading || devices.isLoading) return <div className="page"><Loading /></div>;
  const o = overview.data!;
  const allLines = (factories.data ?? []).flatMap((f) => f.lines.map((l) => ({ id: l.id, label: `${f.code} · Line ${l.name}` })));

  const run = async (p: Promise<unknown>, ok: string) => {
    try { await p; toast(ok); } catch (e: any) { toast(e?.response?.data?.error || 'Action failed', 'err'); }
  };
  const rename = (id: string, current: string | null) => {
    const name = window.prompt('Station name', current ?? '');
    if (name && name.trim()) run(act.rename.mutateAsync({ id, name: name.trim() }), 'Renamed');
  };
  const remove = (id: string, label: string) => {
    if (window.confirm(`Remove device "${label}"? It will re-register next time it opens the station.`)) run(act.remove.mutateAsync(id), 'Device removed');
  };

  const stats = [
    { label: 'Factories', value: o.factories },
    { label: 'Lines', value: o.lines },
    { label: 'Users', value: o.users },
    { label: 'Station Devices', value: o.devices },
    { label: 'Locked', value: o.lockedDevices, accent: true },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>System Administration</h1>
          <div className="sub">Manage station PCs — lock a device to one line, or unlock it.</div>
        </div>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {stats.map((s) => (
          <div key={s.label} className={`card kpi ${s.accent ? 'accent' : ''}`}>
            <div className="label eyebrow">{s.label}</div>
            <div className="value tnum">{fmt(s.value)}</div>
          </div>
        ))}
      </div>

      <div className="sec-title"><h2>Station Devices</h2><div className="ln" />
        <span className="muted" style={{ fontSize: 12 }}>A device registers automatically when it opens the station</span>
      </div>

      <div className="tablewrap">
        <table className="data" style={{ minWidth: 820 }}>
          <thead><tr>
            <th>Station</th><th>IP Address</th><th>Locked To</th><th>Status</th><th>Last seen</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {devices.data!.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>No station devices yet. Open <code>/station</code> on a line PC to register it.</td></tr>
            ) : devices.data!.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name || '—'}</td>
                <td className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.ipAddress || '—'}</td>
                <td>{d.locked && d.lockTarget ? <span className="linetag"><span className="dot" style={{ background: d.lockType === 'line' && d.factory ? `var(--f-${d.factory})` : 'var(--brand)' }} />{d.lockType === 'pm' ? `PM · ${d.lockTarget}` : d.lockTarget}</span> : <span className="muted">—</span>}</td>
                <td>{d.locked ? <span className="pill crit"><i />Locked</span> : <span className="pill good"><i />Free</span>}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{timeAgo(d.lastSeen)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {d.locked ? (
                      <button className="btn primary" style={{ padding: '6px 11px', fontSize: 12.5 }} disabled={act.unlock.isPending} onClick={() => run(act.unlock.mutateAsync(d.id), 'Device unlocked')}>Unlock</button>
                    ) : (
                      <>
                        <select className="select" style={{ padding: '6px 24px 6px 9px', fontSize: 12.5, minWidth: 150 }} value={pick[d.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [d.id]: e.target.value }))}>
                          <option value="">Lock to line…</option>
                          {allLines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <button className="btn" style={{ padding: '6px 11px', fontSize: 12.5 }} disabled={!pick[d.id] || act.lock.isPending} onClick={() => run(act.lock.mutateAsync({ id: d.id, lineId: pick[d.id] }), 'Device locked')}>Lock</button>
                      </>
                    )}
                    <button className="btn ghost" style={{ padding: '6px 9px', fontSize: 12.5 }} onClick={() => rename(d.id, d.name)}>Rename</button>
                    <button className="btn ghost" style={{ padding: '6px 9px', fontSize: 12.5, color: 'var(--crit)' }} onClick={() => remove(d.id, d.name || d.id.slice(0, 8))}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
