import { useState } from 'react';
import {
  useSysOverview, useSysDevices, useSysDeviceAction, usePublicFactories,
  useSysUsers, useSysUserActions, type NewUser,
} from '../api/hooks';
import type { Factory, ManagedRole, SysUser } from '../api/types';
import { fmt } from '../lib/format';
import { Loading, useToast } from '../components/ui';

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ROLE_LABELS: Record<ManagedRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  EXECUTIVE: 'Executive (Management)',
  WORK_STUDY: 'Work Study',
  PRODUCTION_MANAGER: 'Production Manager',
  SYS_ADMIN: 'System Admin',
};
const ROLE_ORDER: ManagedRole[] = ['SUPER_ADMIN', 'EXECUTIVE', 'WORK_STUDY', 'PRODUCTION_MANAGER', 'SYS_ADMIN'];
const needsFactory = (r: ManagedRole) => r === 'WORK_STUDY' || r === 'PRODUCTION_MANAGER';
const EMPTY: NewUser = { username: '', name: '', password: '', role: 'WORK_STUDY', factoryId: '' };

function run(p: Promise<unknown>, ok: string, toast: ReturnType<typeof useToast>) {
  return p.then(() => toast(ok)).catch((e: any) => toast(e?.response?.data?.error || 'Action failed', 'err'));
}

function UsersSection({ factories }: { factories: Factory[] }) {
  const toast = useToast();
  const users = useSysUsers();
  const act = useSysUserActions();
  const [form, setForm] = useState<NewUser>(EMPTY);
  const [editLines, setEditLines] = useState<SysUser | null>(null);

  const set = (patch: Partial<NewUser>) => setForm((f) => ({ ...f, ...patch }));
  const factoryLabel = (id: string | null) => factories.find((f) => f.id === id)?.code ?? '—';

  const submit = async () => {
    if (!form.username.trim() || !form.name.trim() || !form.password) return toast('Fill in username, name and password', 'err');
    if (needsFactory(form.role) && !form.factoryId) return toast('Pick a factory for this role', 'err');
    const payload: NewUser = { ...form, factoryId: needsFactory(form.role) ? form.factoryId : null };
    await run(act.create.mutateAsync(payload).then(() => setForm(EMPTY)), 'User created', toast);
  };
  const resetPw = (u: SysUser) => {
    const pw = window.prompt(`New password for "${u.username}"`, '');
    if (pw && pw.length >= 4) run(act.update.mutateAsync({ id: u.id, password: pw }), 'Password reset', toast);
    else if (pw !== null) toast('Password must be at least 4 characters', 'err');
  };
  const toggleActive = (u: SysUser) => run(act.update.mutateAsync({ id: u.id, isActive: !u.isActive }), u.isActive ? 'User deactivated' : 'User activated', toast);
  const remove = (u: SysUser) => { if (window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) run(act.remove.mutateAsync(u.id), 'User deleted', toast); };

  if (users.isLoading) return <div className="card" style={{ padding: 24 }}><Loading /></div>;
  const list = (users.data ?? []).slice().sort((a, b) => Number(b.isActive) - Number(a.isActive) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.username.localeCompare(b.username));

  return (
    <>
      <div className="sec-title"><h2>Users &amp; Logins</h2><div className="ln" />
        <span className="muted" style={{ fontSize: 12 }}>{list.filter((u) => u.isActive).length} active</span>
      </div>

      {/* Add user */}
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
          <label className="field"><span className="eyebrow">Username</span>
            <input className="input" value={form.username} autoCapitalize="none" placeholder="e.g. ws.agl" onChange={(e) => set({ username: e.target.value })} />
          </label>
          <label className="field"><span className="eyebrow">Full name</span>
            <input className="input" value={form.name} placeholder="e.g. Rahim Uddin" onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="field"><span className="eyebrow">Password</span>
            <input className="input" value={form.password} type="text" placeholder="min 4 chars" onChange={(e) => set({ password: e.target.value })} />
          </label>
          <label className="field"><span className="eyebrow">Role</span>
            <select className="select" value={form.role} onChange={(e) => set({ role: e.target.value as ManagedRole, factoryId: '' })}>
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label className="field" style={{ visibility: needsFactory(form.role) ? 'visible' : 'hidden' }}><span className="eyebrow">Factory</span>
            <select className="select" value={form.factoryId ?? ''} onChange={(e) => set({ factoryId: e.target.value })}>
              <option value="">Select…</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
            </select>
          </label>
          <button className="btn primary" style={{ height: 40 }} disabled={act.create.isPending} onClick={submit}>Add user</button>
        </div>
      </div>

      <div className="tablewrap">
        <table className="data" style={{ minWidth: 860 }}>
          <thead><tr>
            <th>User</th><th>Role</th><th>Factory</th><th>Lines</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>No users yet.</td></tr>
            ) : list.map((u) => (
              <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                <td><div style={{ fontWeight: 600 }}>{u.username}</div><div className="muted" style={{ fontSize: 12 }}>{u.name}</div></td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.factoryCode ?? <span className="muted">—</span>}</td>
                <td>
                  {u.role === 'PRODUCTION_MANAGER'
                    ? <button className="btn ghost" style={{ padding: '5px 9px', fontSize: 12.5 }} onClick={() => setEditLines(u)}>{u.managedLines} line{u.managedLines === 1 ? '' : 's'} · edit</button>
                    : <span className="muted">—</span>}
                </td>
                <td>{u.isActive ? <span className="pill good"><i />Active</span> : <span className="pill crit"><i />Disabled</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn ghost" style={{ padding: '6px 9px', fontSize: 12.5 }} onClick={() => resetPw(u)}>Reset password</button>
                    <button className="btn ghost" style={{ padding: '6px 9px', fontSize: 12.5 }} onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button className="btn ghost" style={{ padding: '6px 9px', fontSize: 12.5, color: 'var(--crit)' }} onClick={() => remove(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editLines && <PmLinesEditor pm={editLines} factories={factories} onClose={() => setEditLines(null)} onSave={(lineIds) => run(act.setLines.mutateAsync({ id: editLines.id, lineIds }).then(() => setEditLines(null)), 'Lines updated', toast)} saving={act.setLines.isPending} />}
    </>
  );
}

function PmLinesEditor({ pm, factories, onClose, onSave, saving }: { pm: SysUser; factories: Factory[]; onClose: () => void; onSave: (ids: string[]) => void; saving: boolean }) {
  const factory = factories.find((f) => f.id === pm.factoryId);
  const lines = factory?.lines ?? [];
  const [sel, setSel] = useState<Set<string>>(new Set(pm.managedLineIds));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,22,34,.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 20, width: 'min(560px,100%)', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Lines for {pm.name}</h3>
          <button className="btn ghost" style={{ padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{factory ? `${factory.code} · ${factory.name}` : 'No factory assigned'} — {sel.size} selected</div>
        {lines.length === 0 ? (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>This PM has no factory, or the factory has no lines.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSel(new Set(lines.map((l) => l.id)))}>Select all</button>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSel(new Set())}>Clear</button>
            </div>
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, paddingRight: 4 }}>
              {lines.map((l) => (
                <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', background: sel.has(l.id) ? 'var(--brand-wash,rgba(37,99,235,.08))' : 'transparent' }}>
                  <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
                  <span style={{ fontSize: 13 }}>Line {l.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving} onClick={() => onSave([...sel])}>Save lines</button>
        </div>
      </div>
    </div>
  );
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
  const facs = factories.data ?? [];
  const allLines = facs.flatMap((f) => f.lines.map((l) => ({ id: l.id, label: `${f.code} · Line ${l.name}` })));

  const runDev = async (p: Promise<unknown>, ok: string) => {
    try { await p; toast(ok); } catch (e: any) { toast(e?.response?.data?.error || 'Action failed', 'err'); }
  };
  const rename = (id: string, current: string | null) => {
    const name = window.prompt('Station name', current ?? '');
    if (name && name.trim()) runDev(act.rename.mutateAsync({ id, name: name.trim() }), 'Renamed');
  };
  const remove = (id: string, label: string) => {
    if (window.confirm(`Remove device "${label}"? It will re-register next time it opens the station.`)) runDev(act.remove.mutateAsync(id), 'Device removed');
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
          <div className="sub">Manage logins and station PCs.</div>
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

      <UsersSection factories={facs} />

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
                      <button className="btn primary" style={{ padding: '6px 11px', fontSize: 12.5 }} disabled={act.unlock.isPending} onClick={() => runDev(act.unlock.mutateAsync(d.id), 'Device unlocked')}>Unlock</button>
                    ) : (
                      <>
                        <select className="select" style={{ padding: '6px 24px 6px 9px', fontSize: 12.5, minWidth: 150 }} value={pick[d.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [d.id]: e.target.value }))}>
                          <option value="">Lock to line…</option>
                          {allLines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <button className="btn" style={{ padding: '6px 11px', fontSize: 12.5 }} disabled={!pick[d.id] || act.lock.isPending} onClick={() => runDev(act.lock.mutateAsync({ id: d.id, lineId: pick[d.id] }), 'Device locked')}>Lock</button>
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
