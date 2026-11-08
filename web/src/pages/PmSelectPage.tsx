import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicPms, useDevice } from '../api/hooks';
import { facVar } from '../lib/format';
import { getDeviceId } from '../lib/device';
import { Loading } from '../components/ui';
import type { PmLite } from '../api/types';

export default function PmSelectPage() {
  const nav = useNavigate();
  const pms = usePublicPms();
  const deviceId = useMemo(getDeviceId, []);
  const device = useDevice(deviceId);
  const lockedPmId = device.data?.lockType === 'pm' ? device.data.lockedPmId : null;

  // A TV locked to a PM goes straight to that board — it can't pick another.
  useEffect(() => {
    if (lockedPmId) nav(`/pm/${lockedPmId}`, { replace: true });
  }, [lockedPmId, nav]);

  const byFactory = useMemo(() => {
    const map = new Map<string, PmLite[]>();
    (pms.data ?? []).forEach((p) => {
      const k = p.factory ?? '—';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return [...map.entries()];
  }, [pms.data]);

  if (pms.isLoading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <div className="page-head"><div><h1>PM Boards</h1><div className="sub">Pick a Production Manager to display their lines on the TV</div></div></div>
      {byFactory.map(([factory, list]) => (
        <div key={factory}>
          <div className="sec-title"><h2><span className="dot" style={{ background: facVar(factory), marginRight: 8 }} />{list[0]?.factoryName || factory}</h2><div className="ln" /></div>
          <div className="pm-grid">
            {list.map((p) => (
              <button key={p.id} className="card pm-pick" onClick={() => nav(`/pm/${p.id}`)} style={{ ['--ac' as any]: facVar(factory) }}>
                <div className="pm-badge">{p.name.replace(/[^0-9]/g, '') || 'PM'}</div>
                <div className="pm-meta">
                  <b>{p.name}</b>
                  <span>{p.lineCount} lines</span>
                </div>
                <span className="pm-go">Open →</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
