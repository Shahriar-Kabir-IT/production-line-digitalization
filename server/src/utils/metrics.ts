// Single source of truth for every production/quality calculation.
// Efficiency uses checkedQty as the hourly output (end-line checks 100%).
// DHU% = Total Defects × 100 / Total Checked Quantity  (form Q-SEW006-01).

export type PlanInput = {
  smv: number;
  manpower: number;
  dayTarget: number;
  plannedHours: number;
};

export type EntryInput = {
  hourIndex: number;
  hourLabel: string;
  checkedQty: number;
  defectCount: number;
};

export type LineStatus = 'good' | 'warn' | 'crit';

/** Hourly efficiency %: Checked (= Output) × SMV / (Manpower × 60) × 100 */
export function hourlyEfficiency(checkedQty: number, smv: number, manpower: number): number {
  if (manpower <= 0) return 0;
  return (checkedQty * smv) / (manpower * 60) * 100;
}

export function targetEfficiency(p: PlanInput): number {
  const available = p.manpower * 60 * p.plannedHours;
  if (available <= 0) return 0;
  return (p.dayTarget * p.smv) / available * 100;
}

export function statusFromEfficiency(avgEff: number, targetEff: number): LineStatus {
  if (targetEff <= 0) return 'crit';
  const ratio = avgEff / targetEff;
  if (ratio >= 0.92) return 'good';
  if (ratio >= 0.75) return 'warn';
  return 'crit';
}

export type LineMetrics = {
  workedHours: number;
  achieved: number;
  projected: number;
  hourlyTarget: number;
  paceTarget: number;
  pctOfDay: number;
  pctOfPace: number;
  avgEff: number;
  targetEff: number;
  totalDefects: number;
  totalChecked: number;
  dhu: number;       // line DHU% = totalDefects × 100 / totalChecked
  bestHourEff: number;
  status: LineStatus;
  series: {
    labels: string[];
    output: (number | null)[];
    cumulative: (number | null)[];
    pace: number[];
    efficiency: (number | null)[];
    dhu: (number | null)[];
  };
};

export function computeLineMetrics(plan: PlanInput, entries: EntryInput[], hourLabels: string[]): LineMetrics {
  const sorted = [...entries].sort((a, b) => a.hourIndex - b.hourIndex);
  const workedHours = sorted.length;
  const achieved = sorted.reduce((s, e) => s + e.checkedQty, 0);
  const totalDefects = sorted.reduce((s, e) => s + e.defectCount, 0);
  const totalChecked = achieved;
  const effByHour = sorted.map((e) => hourlyEfficiency(e.checkedQty, plan.smv, plan.manpower));
  const avgEff = effByHour.length ? effByHour.reduce((a, b) => a + b, 0) / effByHour.length : 0;
  const hourlyTarget = plan.plannedHours ? plan.dayTarget / plan.plannedHours : 0;
  const paceTarget = hourlyTarget * workedHours;
  const projected = workedHours ? Math.round((achieved / workedHours) * plan.plannedHours) : 0;
  const targetEff = targetEfficiency(plan);
  const dhu = totalChecked > 0 ? (totalDefects * 100) / totalChecked : 0;

  const byIndex = new Map(sorted.map((e) => [e.hourIndex, e]));
  const output: (number | null)[] = [];
  const cumulative: (number | null)[] = [];
  const efficiency: (number | null)[] = [];
  const dhuSeries: (number | null)[] = [];
  const pace: number[] = [];
  let run = 0;
  let seenGap = false;
  for (let i = 0; i < hourLabels.length; i++) {
    pace.push(Math.round(hourlyTarget * (i + 1)));
    const e = byIndex.get(i);
    if (e && !seenGap) {
      run += e.checkedQty;
      output.push(e.checkedQty);
      cumulative.push(run);
      efficiency.push(+hourlyEfficiency(e.checkedQty, plan.smv, plan.manpower).toFixed(1));
      dhuSeries.push(e.checkedQty > 0 ? +((e.defectCount * 100) / e.checkedQty).toFixed(1) : 0);
    } else {
      seenGap = true;
      output.push(null); cumulative.push(null); efficiency.push(null); dhuSeries.push(null);
    }
  }

  return {
    workedHours, achieved, projected,
    hourlyTarget: Math.round(hourlyTarget),
    paceTarget: Math.round(paceTarget),
    pctOfDay: plan.dayTarget ? (achieved / plan.dayTarget) * 100 : 0,
    pctOfPace: paceTarget ? (achieved / paceTarget) * 100 : 0,
    avgEff: +avgEff.toFixed(1),
    targetEff: +targetEff.toFixed(1),
    totalDefects,
    totalChecked,
    dhu: +dhu.toFixed(1),
    bestHourEff: effByHour.length ? +Math.max(...effByHour).toFixed(1) : 0,
    status: statusFromEfficiency(avgEff, targetEff),
    series: { labels: hourLabels, output, cumulative, pace, efficiency, dhu: dhuSeries },
  };
}
