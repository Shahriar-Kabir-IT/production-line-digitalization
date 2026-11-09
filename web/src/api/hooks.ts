import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { Board, DefectAnalytics, Device, Factory, LineRow, ManagedRole, Overview, PlanRecord, PmDashboard, PmLite, Station, SysOverview, SysUser } from './types';

// ---- authenticated (Work Study / Super Admin) ----
export function useFactories() {
  return useQuery({ queryKey: ['factories'], queryFn: async () => (await client.get<{ factories: Factory[] }>('/factories')).data.factories });
}
export function useOverview(date: string) {
  return useQuery({ queryKey: ['overview', date], queryFn: async () => (await client.get<Overview>('/dashboard/overview', { params: { date } })).data });
}
export function useLineRows(date: string, factoryId?: string) {
  return useQuery({ queryKey: ['lineRows', date, factoryId ?? 'all'], queryFn: async () => (await client.get<{ rows: LineRow[] }>('/dashboard/lines', { params: { date, factoryId } })).data.rows });
}
export function useDefects(date: string, factoryId?: string) {
  return useQuery({ queryKey: ['defects', date, factoryId ?? 'all'], queryFn: async () => (await client.get<DefectAnalytics>('/dashboard/defects', { params: { date, factoryId } })).data });
}
export function usePlan(lineId: string | undefined, date: string) {
  return useQuery({ enabled: !!lineId, queryKey: ['plan', lineId, date], queryFn: async () => (await client.get<{ plan: PlanRecord | null }>('/workstudy', { params: { lineId, date } })).data.plan });
}
export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await client.post('/workstudy', body)).data,
    onSuccess: () => {
      ['plan', 'overview', 'lineRows', 'defects', 'station', 'board'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ---- public (no-login kiosk) ----
export function usePublicFactories() {
  return useQuery({ queryKey: ['pubFactories'], queryFn: async () => (await client.get<{ factories: Factory[] }>('/public/factories')).data.factories });
}
export function useBoard(lineId: string | undefined, date?: string) {
  return useQuery({ enabled: !!lineId, queryKey: ['board', lineId, date ?? 'today'], queryFn: async () => (await client.get<Board>(`/public/board/${lineId}`, { params: { date } })).data });
}
export function useStation(lineId: string | undefined) {
  return useQuery({
    enabled: !!lineId,
    queryKey: ['station', lineId],
    refetchInterval: 15_000, // keep lock state fresh as hours roll over
    queryFn: async () => (await client.get<Station>(`/public/station/${lineId}`)).data,
  });
}
function patchHour(st: Station, hourIndex: number, fn: (h: Station['hours'][number]) => void): Station {
  const hours = st.hours.map((h) => {
    if (h.hourIndex !== hourIndex) return h;
    const nh = { ...h, defects: { ...h.defects } };
    fn(nh);
    nh.totalDefects = Object.values(nh.defects).reduce((s, n) => s + n, 0);
    nh.dhu = nh.checkedQty > 0 ? +((nh.totalDefects * 100) / nh.checkedQty).toFixed(1) : 0;
    return nh;
  });
  return { ...st, hours };
}

export function useAdjustCheck(lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { date: string; hourIndex: number; delta: number }) => (await client.post<Station>(`/public/station/${lineId}/check`, b)).data,
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: ['station', lineId] });
      const prev = qc.getQueryData<Station>(['station', lineId]);
      if (prev) qc.setQueryData(['station', lineId], patchHour(prev, b.hourIndex, (h) => { h.checkedQty = Math.max(0, h.checkedQty + b.delta); }));
      return { prev };
    },
    onError: (_e, _b, ctx) => ctx?.prev && qc.setQueryData(['station', lineId], ctx.prev),
    onSuccess: (data) => qc.setQueryData(['station', lineId], data),
  });
}
// ---- production manager boards (public TV) ----
export function usePublicPms() {
  return useQuery({ queryKey: ['pms'], queryFn: async () => (await client.get<{ pms: PmLite[] }>('/public/pms')).data.pms });
}
export function usePmDashboard(pmId: string | undefined, date: string) {
  return useQuery({
    enabled: !!pmId,
    queryKey: ['pmDashboard', pmId, date],
    refetchInterval: 30_000,
    queryFn: async () => (await client.get<PmDashboard>(`/public/pm/${pmId}/dashboard`, { params: { date } })).data,
  });
}

// ---- station device lock (public) ----
export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['device', deviceId],
    refetchInterval: 15_000, // notice sysadmin unlock within ~15s
    queryFn: async () => (await client.get<Device>(`/public/device/${deviceId}`)).data,
  });
}
export function useLockDevice(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { lineId: string; name?: string }) => (await client.post<Device>(`/public/device/${deviceId}/lock`, b)).data,
    onSuccess: (d) => qc.setQueryData(['device', deviceId], d),
  });
}
export function useLockDeviceToPm(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { pmId: string; name?: string }) => (await client.post<Device>(`/public/device/${deviceId}/lock-pm`, b)).data,
    onSuccess: (d) => qc.setQueryData(['device', deviceId], d),
  });
}

// ---- sysadmin ----
export function useSysOverview() {
  return useQuery({ queryKey: ['sysOverview'], queryFn: async () => (await client.get<SysOverview>('/sysadmin/overview')).data });
}
export function useSysDevices() {
  return useQuery({ queryKey: ['sysDevices'], refetchInterval: 15_000, queryFn: async () => (await client.get<{ devices: Device[] }>('/sysadmin/devices')).data.devices });
}
export function useSysDeviceAction() {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['sysDevices'] }); qc.invalidateQueries({ queryKey: ['sysOverview'] }); };
  return {
    unlock: useMutation({ mutationFn: async (id: string) => (await client.post(`/sysadmin/devices/${id}/unlock`)).data, onSuccess: refresh }),
    lock: useMutation({ mutationFn: async (v: { id: string; lineId: string }) => (await client.post(`/sysadmin/devices/${v.id}/lock`, { lineId: v.lineId })).data, onSuccess: refresh }),
    rename: useMutation({ mutationFn: async (v: { id: string; name: string }) => (await client.patch(`/sysadmin/devices/${v.id}`, { name: v.name })).data, onSuccess: refresh }),
    remove: useMutation({ mutationFn: async (id: string) => (await client.delete(`/sysadmin/devices/${id}`)).data, onSuccess: refresh }),
  };
}

export function useSysUsers() {
  return useQuery({ queryKey: ['sysUsers'], queryFn: async () => (await client.get<{ users: SysUser[] }>('/sysadmin/users')).data.users });
}
export type NewUser = { username: string; name: string; password: string; role: ManagedRole; factoryId?: string | null };
export type EditUser = { id: string; name?: string; role?: ManagedRole; factoryId?: string | null; isActive?: boolean; password?: string };
export function useSysUserActions() {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['sysUsers'] }); qc.invalidateQueries({ queryKey: ['sysOverview'] }); };
  return {
    create: useMutation({ mutationFn: async (v: NewUser) => (await client.post('/sysadmin/users', v)).data, onSuccess: refresh }),
    update: useMutation({ mutationFn: async ({ id, ...rest }: EditUser) => (await client.patch(`/sysadmin/users/${id}`, rest)).data, onSuccess: refresh }),
    remove: useMutation({ mutationFn: async (id: string) => (await client.delete(`/sysadmin/users/${id}`)).data, onSuccess: refresh }),
    setLines: useMutation({ mutationFn: async (v: { id: string; lineIds: string[] }) => (await client.patch(`/sysadmin/users/${v.id}/lines`, { lineIds: v.lineIds })).data, onSuccess: refresh }),
  };
}

export function useAdjustDefect(lineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { date: string; hourIndex: number; code: string; delta: number }) => (await client.post<Station>(`/public/station/${lineId}/defect`, b)).data,
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: ['station', lineId] });
      const prev = qc.getQueryData<Station>(['station', lineId]);
      if (prev) qc.setQueryData(['station', lineId], patchHour(prev, b.hourIndex, (h) => { h.defects[b.code] = Math.max(0, (h.defects[b.code] ?? 0) + b.delta); }));
      return { prev };
    },
    onError: (_e, _b, ctx) => ctx?.prev && qc.setQueryData(['station', lineId], ctx.prev),
    onSuccess: (data) => qc.setQueryData(['station', lineId], data),
  });
}
