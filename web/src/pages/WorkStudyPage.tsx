import { useEffect, useMemo, useState } from 'react';
import { useFactories, usePlan, useSavePlan } from '../api/hooks';
import { fmt, todayStr } from '../lib/format';
import { Loading, useToast } from '../components/ui';

const BUYERS = ['H&M', 'KMART', 'LC Waikiki', 'S&G', 'ZXY', 'GTGS', 'Zara', 'Primark', 'C&A', 'Lindex', 'Next', 'Decathlon'];
const PLANNED_HOURS = 11;
const MAX_HOURS = 14;

export default function WorkStudyPage() {
  const toast = useToast();
  const factories = useFactories();
  const save = useSavePlan();

  const [factoryId, setFactoryId] = useState('');
  const [lineId, setLineId] = useState('');
  const [date, setDate] = useState(todayStr());

  const [buyerName, setBuyerName] = useState('');
  const [style, setStyle] = useState('');
  const [smv, setSmv] = useState(16);
  const [manpower, setManpower] = useState(55);
  const [dayTarget, setDayTarget] = useState(1700);
  const [workingHours, setWorkingHours] = useState<string>(String(PLANNED_HOURS));
  // numeric working hours used for calculations & saving (free-typed string → clamped 1..MAX)
  const whNum = (() => { const n = Math.floor(Number(workingHours)); return n >= 1 ? Math.min(n, MAX_HOURS) : PLANNED_HOURS; })();

  // default factory/line once factories load
  useEffect(() => {
    if (factories.data && !factoryId) {
      const f = factories.data[0];
      if (f) { setFactoryId(f.id); setLineId(f.lines[0]?.id ?? ''); }
    }
  }, [factories.data, factoryId]);

  const currentFactory = factories.data?.find((f) => f.id === factoryId);

  // Keep the selected line consistent with the selected factory (self-heal).
  useEffect(() => {
    if (currentFactory && currentFactory.lines.length && !currentFactory.lines.some((l) => l.id === lineId)) {
      setLineId(currentFactory.lines[0].id);
    }
  }, [currentFactory, lineId]);

  const plan = usePlan(lineId || undefined, date);

  // sync form from loaded plan
  useEffect(() => {
    if (plan.data) {
      setBuyerName(plan.data.buyerName);
      setStyle(plan.data.style);
      setSmv(plan.data.smv);
      setManpower(plan.data.manpower);
      setDayTarget(plan.data.dayTarget);
      setWorkingHours(String(plan.data.plannedHours ?? PLANNED_HOURS));
    } else if (plan.isFetched && !plan.data) {
      setBuyerName(''); setStyle('');
    }
  }, [plan.data, plan.isFetched, lineId, date]);

  const derived = useMemo(() => {
    const available = manpower * 60 * whNum;
    const std = dayTarget * smv;
    const targetEff = available ? (std / available) * 100 : 0;
    return { hourlyTarget: Math.round(dayTarget / whNum), targetEff, std, available };
  }, [smv, manpower, dayTarget, whNum]);

  if (factories.isLoading) return <div className="page"><Loading /></div>;

  async function onSave() {
    if (!lineId) return;
    try {
      await save.mutateAsync({ lineId, date, buyerName: buyerName || 'N/A', style: style || 'N/A', smv: Number(smv), manpower: Number(manpower), dayTarget: Number(dayTarget), plannedHours: whNum });
      toast('Line plan saved');
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not save', 'err');
    }
  }

  const effClass = derived.targetEff >= 72 ? 'good' : derived.targetEff >= 60 ? 'warn' : 'crit';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Work Study · Daily Line Plan</h1>
          <div className="sub">Set the plan the line’s hourly sheet and TV board calculate against</div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="card pad">
          <div className="grid2">
            <div className="field">
              <label>Factory</label>
              <select className="select" value={factoryId} onChange={(e) => { setFactoryId(e.target.value); const f = factories.data?.find((x) => x.id === e.target.value); setLineId(f?.lines[0]?.id ?? ''); }}>
                {factories.data?.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Line</label>
            <select className="select" value={lineId} onChange={(e) => setLineId(e.target.value)}>
              {!lineId && <option value="">Select line…</option>}
              {currentFactory?.lines.map((l) => <option key={l.id} value={l.id}>Line {l.name}</option>)}
            </select>
          </div>

          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Buyer</label>
              <input className="input" list="buyers" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Select or type" />
              <datalist id="buyers">{BUYERS.map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <div className="field">
              <label>Style</label>
              <input className="input" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Style / order ref" />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="field"><label>SMV</label><input className="input tnum" type="number" step="0.1" value={smv} onChange={(e) => setSmv(+e.target.value)} /></div>
            <div className="field"><label>Manpower (M/P)</label><input className="input tnum" type="number" value={manpower} onChange={(e) => setManpower(+e.target.value)} /></div>
          </div>
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="field"><label>Day Target (pcs)</label><input className="input tnum" type="number" value={dayTarget} onChange={(e) => setDayTarget(+e.target.value)} /></div>
            <div className="field"><label>Working Hours</label><input className="input tnum" type="number" min={1} max={MAX_HOURS} value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} onBlur={() => setWorkingHours(String(whNum))} /><span className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Productive hours for this line (1–{MAX_HOURS})</span></div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn primary" onClick={onSave} disabled={save.isPending || !lineId}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
              {save.isPending ? 'Saving…' : plan.data ? 'Update plan' : 'Save plan'}
            </button>
            {plan.data && <span className="pill good" style={{ alignSelf: 'center' }}><i />Plan exists for this date</span>}
          </div>
        </div>

        <div className="card pad">
          <h3 className="ct">Derived Plan</h3>
          <div className="cap">Auto-calculated from the figures on the left</div>
          <div className="efflegend">
            <div className="row"><span className="k">Hourly target</span><span className="v">{fmt(derived.hourlyTarget)} pcs</span></div>
            <div className="row"><span className="k">Target efficiency</span><span className="v" style={{ color: `var(--${effClass})` }}>{derived.targetEff.toFixed(1)}%</span></div>
            <div className="row"><span className="k">Std. minutes / day</span><span className="v">{fmt(Math.round(derived.std))} min</span></div>
            <div className="row"><span className="k">Available minutes / day</span><span className="v">{fmt(derived.available)} min</span></div>
            <div className="row"><span className="k">Planned hours</span><span className="v">{whNum}</span></div>
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }}>Target efficiency formula</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.7 }}>
            Eff% = (Target × SMV) ÷ (M/P × 60 × {whNum}) × 100
          </div>
        </div>
      </div>
    </div>
  );
}
