export type Role = 'SUPER_ADMIN' | 'WORK_STUDY' | 'LINE_WORKER' | 'SYS_ADMIN' | 'PRODUCTION_MANAGER' | 'EXECUTIVE';
export type Status = 'good' | 'warn' | 'crit';
export type HourState = 'locked' | 'open' | 'upcoming';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  factoryId: string | null;
  lineId: string | null;
  factoryCode: string | null;
  factoryName: string | null;
}

export interface LineLite { id: string; name: string; isActive: boolean; }
export interface Factory { id: string; code: string; name: string; lines: LineLite[]; }
export interface DefectCode { code: string; name: string; }

export interface FactoryOverview {
  factoryId: string; code: string; name: string;
  lineCount: number; reporting: number;
  target: number; achieved: number; projected: number;
  avgEff: number; targetEff: number; dhu: number; pct: number;
}
export interface Overview {
  date: string;
  factories: FactoryOverview[];
  totals: { factories: number; lines: number; reporting: number; target: number; achieved: number; projected: number; defects: number; avgEff: number; dhu: number };
}

export interface LineRow {
  lineId: string; line: string; factoryId: string; factory: string;
  buyer: string; style: string; smv: number; manpower: number;
  dayTarget: number; achieved: number; projected: number;
  avgEff: number; targetEff: number; dhu: number; totalDefects: number;
  pctOfDay: number; pctOfPace: number; workedHours: number; status: Status;
}

export interface Plan { buyer: string; style: string; smv: number; manpower: number; dayTarget: number; plannedHours: number; }
export interface PlanRecord { id: string; lineId: string; date: string; buyerName: string; style: string; smv: number; manpower: number; dayTarget: number; plannedHours: number; }

export interface Metrics {
  workedHours: number; achieved: number; projected: number;
  hourlyTarget: number; paceTarget: number; pctOfDay: number; pctOfPace: number;
  avgEff: number; targetEff: number; totalDefects: number; totalChecked: number; dhu: number;
  bestHourEff: number; status: Status;
  series: { labels: string[]; output: (number | null)[]; cumulative: (number | null)[]; pace: number[]; efficiency: (number | null)[]; dhu: (number | null)[]; };
}
export interface Board {
  lineId: string; line: string; factoryId: string; factory: string; factoryName: string; date: string;
  plan: Plan | null; metrics: Metrics | null; hourLabels: string[];
}

export interface StationHour {
  hourIndex: number; hourLabel: string; checkedQty: number;
  defects: Record<string, number>; totalDefects: number; dhu: number; state: HourState;
}
export interface Station {
  lineId: string; line: string; factoryId: string; factory: string; factoryName: string;
  date: string; now: { dateStr: string; hour: number; minute: number };
  defectCodes: DefectCode[];
  plan: Plan | null;
  hours: StationHour[];
  metrics: Metrics | null;
  hourLabels: string[];
  openHourIndex: number;
}

export interface Device {
  id: string; name: string | null; ipAddress: string | null; locked: boolean;
  lockType: 'line' | 'pm' | null; lockTarget: string | null;
  lockedLineId: string | null; line: string | null; factory: string | null; factoryName: string | null;
  lockedPmId: string | null; pmName: string | null;
  lastSeen: string; createdAt: string;
}
export interface SysOverview { factories: number; lines: number; users: number; devices: number; lockedDevices: number; }

export type ManagedRole = 'SUPER_ADMIN' | 'EXECUTIVE' | 'WORK_STUDY' | 'SYS_ADMIN' | 'PRODUCTION_MANAGER';
export interface SysUser {
  id: string; username: string; name: string; role: ManagedRole;
  factoryId: string | null; factoryCode: string | null;
  managedLineIds: string[]; managedLines: number;
  isActive: boolean; createdAt: string;
}

export interface PmLite { id: string; name: string; factory: string | null; factoryName: string | null; lineCount: number; }

export interface PmDashboard {
  date: string;
  pm: { name: string; factory: string | null; factoryName: string | null; lineCount: number; reporting: number };
  totals: { target: number; achieved: number; projected: number; defects: number; avgEff: number; targetEff: number; dhu: number };
  lines: LineRow[];
  byCode: { code: string; name: string; count: number }[];
}

export interface DefectAnalytics {
  date: string;
  totals: { defects: number; checked: number; dhu: number };
  byCode: { code: string; name: string; count: number }[];
  byLine: { lineId: string; line: string; factory: string; checked: number; defects: number; dhu: number }[];
}
