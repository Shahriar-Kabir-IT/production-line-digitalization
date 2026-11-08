import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLineRows } from '../api/hooks';
import { fmt, facVar, todayStr } from '../lib/format';
import { StatusPill, Loading, useToast } from '../components/ui';
import { downloadLineReport } from '../lib/report';
import type { LineRow } from '../api/types';

type SortKey = keyof Pick<LineRow, 'line' | 'factory' | 'buyer' | 'style' | 'smv' | 'manpower' | 'dayTarget' | 'achieved' | 'pctOfPace' | 'avgEff' | 'dhu'>;

export default function LinesPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [factory, setFactory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avgEff');
  const [sortDir, setSortDir] = useState(-1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const rows = useLineRows(date);

  const factories = useMemo(() => {
    const seen = new Set<string>();
    (rows.data ?? []).forEach((r) => seen.add(r.factory));
    return [...seen].sort();
  }, [rows.data]);

  const filtered = useMemo(() => {
    let data = rows.data ? [...rows.data] : [];
    if (factory !== 'ALL') data = data.filter((r) => r.factory === factory);
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter((r) =>
        [r.line, r.factory, r.buyer, r.style, String(r.dayTarget), String(r.achieved), String(r.smv), String(r.manpower)]
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    data.sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * sortDir;
      return ((x as number) - (y as number)) * sortDir;
    });
    return data;
  }, [rows.data, factory, search, sortKey, sortDir]);

  function toggleSort(k: SortKey) { if (sortKey === k) setSortDir((d) => -d); else { setSortKey(k); setSortDir(-1); } }
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir < 0 ? ' ▼' : ' ▲') : '');

  async function onDownload(lineId: string, label: string) {
    setDownloading(lineId);
    try { await downloadLineReport(lineId, date); toast(`Report downloaded — ${label}`); }
    catch (e: any) { toast(e?.response?.data?.error || 'Could not generate report', 'err'); }
    finally { setDownloading(null); }
  }

  const total = rows.data?.length ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Line-wise Output</h1>
          <div className="sub">{filtered.length} of {total} lines{search || factory !== 'ALL' ? ' (filtered)' : ''}</div>
        </div>
        <div className="spacer" />
        <div className="field"><label htmlFor="date">Date</label><input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} /></div>
      </div>

      <div className="lines-toolbar">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search line, factory, buyer, style, SMV…" aria-label="Search lines" />
          {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
        </div>
        {factories.length > 1 && (
          <div className="filters" style={{ margin: 0 }}>
            <button className="chip" aria-pressed={factory === 'ALL'} onClick={() => setFactory('ALL')}>All</button>
            {factories.map((f) => (
              <button key={f} className="chip" aria-pressed={factory === f} onClick={() => setFactory(f)}>
                <span className="dot" style={{ background: facVar(f) }} />{f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tablewrap">
        <table className="data">
          <thead><tr>
            <th className="sortable" onClick={() => toggleSort('line')}>Line{arrow('line')}</th>
            <th className="sortable" onClick={() => toggleSort('factory')}>Factory{arrow('factory')}</th>
            <th className="sortable" onClick={() => toggleSort('buyer')}>Buyer{arrow('buyer')}</th>
            <th className="sortable" onClick={() => toggleSort('style')}>Style{arrow('style')}</th>
            <th className="sortable" onClick={() => toggleSort('smv')}>SMV{arrow('smv')}</th>
            <th className="sortable" onClick={() => toggleSort('manpower')}>M/P{arrow('manpower')}</th>
            <th className="sortable" onClick={() => toggleSort('dayTarget')}>Target{arrow('dayTarget')}</th>
            <th className="sortable" onClick={() => toggleSort('achieved')}>Achieved{arrow('achieved')}</th>
            <th className="sortable" onClick={() => toggleSort('pctOfPace')}>Pace{arrow('pctOfPace')}</th>
            <th className="sortable" onClick={() => toggleSort('avgEff')}>Eff %{arrow('avgEff')}</th>
            <th className="sortable" onClick={() => toggleSort('dhu')}>DHU %{arrow('dhu')}</th>
            <th>Status</th>
            <th>Report</th>
          </tr></thead>
          <tbody>
            {rows.isLoading ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>{total === 0 ? 'No line plans for this date.' : 'No lines match your search.'}</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.lineId}>
                  <td><span className="linetag"><span className="dot" style={{ background: facVar(r.factory) }} /><span className="rowlink" onClick={() => nav(`/tv/${r.lineId}`)}>{r.line}</span></span></td>
                  <td className="muted">{r.factory}</td>
                  <td>{r.buyer}</td>
                  <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.style}</td>
                  <td className="num">{r.smv}</td><td className="num">{r.manpower}</td><td className="num">{fmt(r.dayTarget)}</td>
                  <td className="num">{fmt(r.achieved)} <span className="mini" style={{ marginLeft: 6 }}><i style={{ width: `${Math.min(100, (r.achieved / r.dayTarget) * 100)}%`, background: facVar(r.factory) }} /></span></td>
                  <td className="num" style={{ color: r.pctOfPace >= 100 ? 'var(--good)' : r.pctOfPace >= 85 ? 'var(--warn)' : 'var(--crit)' }}>{r.pctOfPace.toFixed(0)}%</td>
                  <td className="num" style={{ color: `var(--${r.status})`, fontWeight: 600 }}>{r.avgEff.toFixed(1)}</td>
                  <td className="num">{r.dhu.toFixed(1)}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>
                    <button className="dl-btn" title={`Download report — ${r.factory} · Line ${r.line}`} disabled={downloading === r.lineId} onClick={() => onDownload(r.lineId, `${r.factory} · Line ${r.line}`)}>
                      {downloading === r.lineId ? '…' : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 11l5 4 5-4M5 21h14" /></svg>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
