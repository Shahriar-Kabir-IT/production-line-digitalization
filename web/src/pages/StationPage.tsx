import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublicFactories, useStation, useDevice, useLockDevice } from '../api/hooks';
import client from '../api/client';
import { fmt, facVar } from '../lib/format';
import { getDeviceId } from '../lib/device';
import { Loading, useToast } from '../components/ui';
import type { HourState, Station } from '../api/types';

const LS_KEY = 'mes_station_line';
const CUSTOM_KEY = 'mes_custom_defects';
const FLUSH_MS = 350;

export default function StationPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const factories = usePublicFactories();
  const deviceId = useMemo(getDeviceId, []);
  const device = useDevice(deviceId);
  const lockDevice = useLockDevice(deviceId);

  const isLocked = !!device.data?.locked && !!device.data?.lockedLineId;
  const lockedLineId = device.data?.lockedLineId ?? null;

  const [pickedLineId, setPickedLineId] = useState<string>(() => localStorage.getItem(LS_KEY) || '');
  const [factoryId, setFactoryId] = useState<string>('');

  // Ad-hoc defect codes added at THIS station only (kept on this device).
  const [customCodes, setCustomCodes] = useState<{ code: string; name: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
  });
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  function saveCustom(list: { code: string; name: string }[]) {
    setCustomCodes(list);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }
  async function addCustomDefect() {
    const code = newCode.trim().toUpperCase(); const name = newName.trim();
    if (!code || !name) { toast('Enter a short code and a name', 'err'); return; }
    setAddBusy(true);
    try {
      const r = await client.post<{ code: string; name: string }>('/public/defect-codes', { code, name });
      if (!customCodes.some((c) => c.code === r.data.code)) saveCustom([...customCodes, { code: r.data.code, name: r.data.name }]);
      setAddOpen(false); setNewCode(''); setNewName('');
      toast(`Added "${r.data.code}" to this station`);
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not add defect', 'err');
    } finally { setAddBusy(false); }
  }
  function removeCustom(code: string) { saveCustom(customCodes.filter((c) => c.code !== code)); }

  // When locked, the line is forced to the device's locked line.
  const lineId = isLocked ? lockedLineId! : pickedLineId;
  const setLineId = setPickedLineId;

  useEffect(() => { if (pickedLineId) localStorage.setItem(LS_KEY, pickedLineId); }, [pickedLineId]);
  useEffect(() => {
    if (factories.data && !factoryId) {
      const f = factories.data.find((x) => x.lines.some((l) => l.id === lineId)) || factories.data[0];
      setFactoryId(f.id);
    }
  }, [factories.data, factoryId, lineId]);

  const station = useStation(lineId || undefined);

  // ---- local accumulation + debounced single-flight flush (instant, glitch-free) ----
  // pendingRef is the synchronous source of truth; `force` re-renders when it changes.
  const pendingRef = useRef<Record<string, number>>({});
  const [, force] = useReducer((x: number) => x + 1, 0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inFlight = useRef<Set<string>>(new Set());

  // Keyboard: ↓ counts +1, ↑ undoes −1 — without scrolling or changing the dropdown.
  const kbRef = useRef<{ openIdx: number; kC: string; bump: (k: string, d: number) => void }>({ openIdx: -1, kC: '', bump: () => {} });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      // Only real text/select inputs keep native arrow behavior; a focused button must not swallow it.
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      const { openIdx, kC, bump } = kbRef.current;
      if (openIdx < 0) return;
      if (e.key === 'ArrowDown' || e.key === '+' || e.key === '=') { e.preventDefault(); bump(kC, 1); }
      else if (e.key === 'ArrowUp' || e.key === '-') { e.preventDefault(); bump(kC, -1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function setPend(key: string, fn: (v: number) => number) {
    pendingRef.current = { ...pendingRef.current, [key]: fn(pendingRef.current[key] ?? 0) };
    force();
  }
  function bump(key: string, delta: number) {
    setPend(key, (v) => v + delta);
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => flush(key), FLUSH_MS);
  }
  async function flush(key: string) {
    if (inFlight.current.has(key)) { timers.current[key] = setTimeout(() => flush(key), 150); return; }
    const amount = pendingRef.current[key] ?? 0;
    const st = station.data;
    if (!amount || !st) return;
    inFlight.current.add(key);
    try {
      const [kind, hiStr, code] = key.split(':');
      const hourIndex = Number(hiStr);
      const url = kind === 'c' ? `/public/station/${lineId}/check` : `/public/station/${lineId}/defect`;
      const body: Record<string, unknown> = { date: st.date, hourIndex, delta: amount };
      if (kind === 'd') body.code = code;
      const resp = await client.post<Station>(url, body);
      // Land the new server base first, then drop the acked amount from pending —
      // batched into one render, so the displayed number never dips during the round-trip.
      qc.setQueryData(['station', lineId], resp.data);
      setPend(key, (v) => v - amount);
    } catch (e: any) {
      setPend(key, (v) => v - amount); // drop the rejected batch (e.g. hour just locked)
      toast(e?.response?.data?.error || 'That hour is locked', 'err');
      // The hour likely rolled over — resync so the UI opens the new current hour.
      qc.invalidateQueries({ queryKey: ['station', lineId] });
    } finally {
      inFlight.current.delete(key);
      if ((pendingRef.current[key] ?? 0) !== 0) flush(key);
    }
  }

  if (factories.isLoading || device.isLoading) return <div className="page"><Loading /></div>;
  const currentFactory = factories.data?.find((f) => f.id === factoryId);
  const pickedLine = currentFactory?.lines.find((l) => l.id === pickedLineId);

  async function doLock() {
    if (!pickedLineId || !currentFactory || !pickedLine) return;
    try {
      await lockDevice.mutateAsync({ lineId: pickedLineId, name: `${currentFactory.code} · Line ${pickedLine.name}` });
      toast('Station locked to this line');
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not lock', 'err');
    }
  }

  const Selector = isLocked ? (
    <div className="card pad lock-banner" style={{ marginBottom: 16 }}>
      <div className="lb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div>
      <div style={{ flex: 1 }}>
        <b>Station locked to {device.data?.factory} · Line {device.data?.line}</b>
        <span className="muted">Only the System Administrator can change or unlock this PC.</span>
      </div>
    </div>
  ) : (
    <div className="card pad" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
      <div className="field"><label>Factory</label>
        <select className="select" value={factoryId} onChange={(e) => setFactoryId(e.target.value)} style={{ minWidth: 220 }}>
          {factories.data?.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Line</label>
        <select className="select" value={pickedLineId} onChange={(e) => { setLineId(e.target.value); e.target.blur(); }} style={{ minWidth: 160 }}>
          <option value="">Select line…</option>
          {currentFactory?.lines.map((l) => <option key={l.id} value={l.id}>Line {l.name}</option>)}
        </select>
      </div>
      {pickedLineId && (
        <button className="btn" onClick={doLock} disabled={lockDevice.isPending} title="Lock this PC to the selected line" style={{ height: 38 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Lock to this line
        </button>
      )}
    </div>
  );

  if (!lineId) {
    return <div className="page">{Selector}<div className="card pad" style={{ textAlign: 'center', padding: 48 }}>
      <p style={{ fontWeight: 600, fontSize: 16 }}>Select your line to begin.</p>
      <p className="muted">Pick your line, then press <b>Lock to this line</b> to fix this PC to it.</p>
    </div></div>;
  }
  if (station.isLoading || !station.data) return <div className="page">{Selector}<Loading /></div>;

  const s = station.data;
  const plan = s.plan;
  const openIdx = s.openHourIndex;
  const openHour = openIdx >= 0 ? s.hours[openIdx] : null;
  const m = s.metrics;
  const stateDot: Record<HourState, string> = { open: 'var(--good)', locked: 'var(--ink-3)', upcoming: 'var(--border-strong)' };

  // displayed values (server base + un-flushed local deltas)
  const kC = openIdx >= 0 ? `c:${openIdx}` : '';
  kbRef.current = { openIdx, kC, bump };
  const checkedShown = openHour ? Math.max(0, openHour.checkedQty + (pendingRef.current[kC] ?? 0)) : 0;
  const defectShown = (code: string) => {
    if (!openHour) return 0;
    return Math.max(0, (openHour.defects[code] ?? 0) + (pendingRef.current[`d:${openIdx}:${code}`] ?? 0));
  };
  // Standard codes (from the server) + this device's ad-hoc codes, de-duplicated.
  const mergedCodes = [...s.defectCodes, ...customCodes.filter((c) => !s.defectCodes.some((x) => x.code === c.code))];
  const customSet = new Set(customCodes.map((c) => c.code));
  const totalKeys = new Set<string>([...mergedCodes.map((c) => c.code), ...(openHour ? Object.keys(openHour.defects) : [])]);
  const totalDefShown = openHour ? [...totalKeys].reduce((sum, code) => sum + defectShown(code), 0) : 0;
  const hourDhuShown = checkedShown > 0 ? +((totalDefShown * 100) / checkedShown).toFixed(1) : 0;

  return (
    <div className="page">
      {Selector}
      {!plan ? (
        <div className="card pad" style={{ textAlign: 'center', padding: 44 }}>
          <p style={{ fontWeight: 600, fontSize: 16 }}>No Work Study plan set for this line today.</p>
          <p className="muted">Ask the Work Study desk to enter today’s plan (buyer, style, SMV, manpower, target) first.</p>
        </div>
      ) : (
        <>
          <div className="tv-head">
            <div className="lbadge" style={{ background: facVar(s.factory) }}><span><small>LINE</small><b>{s.line.replace('New-', 'N')}</b></span></div>
            <div>
              <h1>{s.factory} · Line {s.line}</h1>
              <div className="meta">
                <span>Buyer <b>{plan.buyer}</b></span><span>·</span><span>Style <b>{plan.style}</b></span><span>·</span>
                <span>SMV <b>{plan.smv}</b></span><span>·</span><span>M/P <b>{plan.manpower}</b></span><span>·</span><span>Target <b>{fmt(plan.dayTarget)}</b></span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="eyebrow">Day so far</div>
              <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 24 }}>{fmt(m?.achieved ?? 0)} <span className="muted" style={{ fontSize: 15 }}>checked</span></div>
              <div className="muted" style={{ fontSize: 12.5 }}>Eff {m?.avgEff ?? 0}% · DHU {m?.dhu ?? 0}%</div>
            </div>
          </div>

          <div className="hourstrip">
            {s.hours.map((h) => (
              <div key={h.hourIndex} className={`hchip ${h.state}`} title={`${h.hourLabel} · ${h.state}`}>
                <div className="hl"><span className="dot" style={{ background: stateDot[h.state] }} />{h.hourLabel}</div>
                <div className="hv tnum">{h.hourIndex === openIdx ? checkedShown : h.checkedQty}</div>
                <div className="hd">{h.state === 'open' ? 'LIVE' : h.totalDefects ? `${h.totalDefects} def` : h.state === 'locked' ? 'locked' : '—'}</div>
              </div>
            ))}
          </div>

          {openIdx < 0 ? (
            <div className="card pad" style={{ textAlign: 'center', padding: 40, marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 16 }}>No hour is open for input right now.</p>
              <p className="muted">Each box opens during its clock hour and locks when the hour ends. The next slot opens on the hour.</p>
            </div>
          ) : (
            <div className="station-grid">
              <div className="card pad counter-card">
                <div className="eyebrow">Now checking · <b style={{ color: 'var(--good)' }}>{openHour!.hourLabel}</b></div>
                <div className="counter-val tnum">{checkedShown}</div>
                <div className="counter-sub">pieces checked this hour</div>
                <div className="counter-btns">
                  <button className="cbtn up" onClick={() => bump(kC, -1)} aria-label="Reduce by one" title="Correct a double count">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
                    <span>−1</span>
                  </button>
                  <button className="cbtn down" onClick={() => bump(kC, 1)} aria-label="Count one piece">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
                    <span>Count +1</span>
                  </button>
                </div>
                <div className="kbd-hint">Keyboard: <kbd>↓</kbd> count · <kbd>↑</kbd> undo</div>
                <div className="counter-foot">
                  <div><span className="muted">Defects</span><b className="tnum">{totalDefShown}</b></div>
                  <div><span className="muted">Hour DHU</span><b className="tnum" style={{ color: hourDhuShown > 7 ? 'var(--crit)' : hourDhuShown > 4 ? 'var(--warn)' : 'var(--good)' }}>{hourDhuShown}%</b></div>
                </div>
              </div>

              <div className="card pad">
                <h3 className="ct">Defects — tap a code to add one</h3>
                <div className="cap">DHU = total defects × 100 ÷ checked quantity. Tap the small − to undo a mistap.</div>
                <div className="defect-grid">
                  {mergedCodes.map((c) => {
                    const cnt = defectShown(c.code);
                    const isCustom = customSet.has(c.code);
                    return (
                      <div key={c.code} className={`dbtn ${cnt ? 'has' : ''} ${isCustom ? 'custom' : ''}`}>
                        <button className="dbtn-main" onClick={() => bump(`d:${openIdx}:${c.code}`, 1)} title={isCustom ? `${c.name} (added here)` : c.name}>
                          <span className="dcode">{c.code}{isCustom && <span style={{ color: 'var(--brand)', marginLeft: 3 }}>★</span>}</span>
                          <span className="dname">{c.name}</span>
                          {cnt > 0 && <span className="dcount">{cnt}</span>}
                        </button>
                        {cnt > 0 && <button className="dminus" onClick={() => bump(`d:${openIdx}:${c.code}`, -1)} aria-label={`Reduce ${c.code}`}>−</button>}
                      </div>
                    );
                  })}
                  <div className="dbtn add-dhu" style={{ border: '1.5px dashed var(--brand)', background: 'var(--brand-050, #eaf0ff)' }}>
                    <button className="dbtn-main" onClick={() => setAddOpen(true)} title="Add a defect that isn't on the list (shows only on this station)" style={{ color: 'var(--brand)' }}>
                      <span className="dcode" style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
                      <span className="dname">Add DHU</span>
                    </button>
                  </div>
                </div>
                {customCodes.length > 0 && (
                  <div className="cap" style={{ marginTop: 10 }}>
                    Added here: {customCodes.map((c) => (
                      <span key={c.code} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                        <b>{c.code}</b> {c.name} <button className="linklike" onClick={() => removeCustom(c.code)} title="Remove from this station" style={{ color: 'var(--crit)', background: 'none', border: 0, cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {addOpen && (
        <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,22,34,.5)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 22, width: 'min(420px,100%)' }}>
            <h3 style={{ margin: '0 0 4px' }}>Add a defect to this station</h3>
            <div className="cap" style={{ marginBottom: 16 }}>Only this PC shows it. Work Study and the dashboards still see it in the DHU reports.</div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Code <span className="muted">(short, e.g. ZB)</span></label>
              <input className="input" value={newCode} maxLength={8} autoCapitalize="characters" placeholder="ZB" onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Defect name</label>
              <input className="input" value={newName} maxLength={60} placeholder="Zipper Broken" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCustomDefect(); }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={addBusy} onClick={addCustomDefect}>Add defect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
