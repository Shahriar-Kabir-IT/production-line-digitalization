import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HOUR_LABELS } from '../../lib/constants';
import { computeLineMetrics, EntryInput } from '../../utils/metrics';
import { AuthUser } from '../../middleware/auth';
import { AppError } from '../../utils/http';

export function normalizeDate(input?: string): Date {
  const base = input ? new Date(`${input}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) throw new AppError(400, 'Invalid date');
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

export const planInclude = {
  include: {
    entries: { include: { defects: true } },
    line: { include: { factory: true } },
    buyer: true,
  },
} satisfies Prisma.WorkStudyPlanDefaultArgs;

export type PlanFull = Prisma.WorkStudyPlanGetPayload<typeof planInclude>;

export function toMetricsInput(plan: PlanFull): EntryInput[] {
  return plan.entries.map((e) => ({
    hourIndex: e.hourIndex,
    hourLabel: e.hourLabel,
    checkedQty: e.checkedQty,
    defectCount: e.defects.reduce((s, d) => s + d.count, 0),
  }));
}

export function metricsFor(plan: PlanFull) {
  return computeLineMetrics(
    { smv: plan.smv, manpower: plan.manpower, dayTarget: plan.dayTarget, plannedHours: plan.plannedHours },
    toMetricsInput(plan),
    HOUR_LABELS,
  );
}

export function scopedFactoryIds(user: AuthUser): string[] | 'ALL' {
  if (user.role === Role.SUPER_ADMIN) return 'ALL';
  if (user.factoryId) return [user.factoryId];
  return [];
}

export function serializeLineRow(plan: PlanFull) {
  const m = metricsFor(plan);
  return {
    lineId: plan.lineId,
    line: plan.line.name,
    factoryId: plan.line.factoryId,
    factory: plan.line.factory.code,
    buyer: plan.buyerName,
    style: plan.style,
    smv: plan.smv,
    manpower: plan.manpower,
    dayTarget: plan.dayTarget,
    achieved: m.achieved,
    projected: m.projected,
    avgEff: m.avgEff,
    targetEff: m.targetEff,
    dhu: m.dhu,
    totalDefects: m.totalDefects,
    pctOfDay: +m.pctOfDay.toFixed(1),
    pctOfPace: +m.pctOfPace.toFixed(1),
    workedHours: m.workedHours,
    status: m.status,
  };
}

async function plansForScope(user: AuthUser, date: Date, factoryId?: string) {
  const scope = scopedFactoryIds(user);
  const where: Prisma.WorkStudyPlanWhereInput = { date };
  if (scope !== 'ALL') where.line = { factoryId: { in: scope } };
  if (factoryId) {
    if (scope !== 'ALL' && !scope.includes(factoryId)) throw new AppError(403, 'Outside your factory scope');
    where.line = { factoryId };
  }
  return prisma.workStudyPlan.findMany({
    where,
    ...planInclude,
    orderBy: [{ line: { factory: { code: 'asc' } } }, { line: { name: 'asc' } }],
  });
}

export async function getLineRows(user: AuthUser, date: Date, factoryId?: string) {
  const plans = await plansForScope(user, date, factoryId);
  return plans.map(serializeLineRow);
}

export async function getOverview(user: AuthUser, date: Date) {
  const rows = await getLineRows(user, date, undefined);
  const scope = scopedFactoryIds(user);
  const factoryWhere = scope === 'ALL' ? {} : { id: { in: scope } };
  const factories = await prisma.factory.findMany({ where: factoryWhere, include: { _count: { select: { lines: true } } }, orderBy: { code: 'asc' } });

  const byFactory = factories.map((f) => {
    const fr = rows.filter((r) => r.factoryId === f.id);
    const target = fr.reduce((s, r) => s + r.dayTarget, 0);
    const achieved = fr.reduce((s, r) => s + r.achieved, 0);
    const projected = fr.reduce((s, r) => s + r.projected, 0);
    const defects = fr.reduce((s, r) => s + r.totalDefects, 0);
    const avgEff = fr.length ? fr.reduce((s, r) => s + r.avgEff, 0) / fr.length : 0;
    const targetEff = fr.length ? fr.reduce((s, r) => s + r.targetEff, 0) / fr.length : 0;
    const dhu = achieved > 0 ? (defects * 100) / achieved : 0;
    return {
      factoryId: f.id, code: f.code, name: f.name, lineCount: f._count.lines, reporting: fr.length,
      target, achieved, projected,
      avgEff: +avgEff.toFixed(1), targetEff: +targetEff.toFixed(1), dhu: +dhu.toFixed(1),
      pct: target ? +((achieved / target) * 100).toFixed(1) : 0,
    };
  });

  const achievedTotal = byFactory.reduce((s, f) => s + f.achieved, 0);
  const reportingTotal = byFactory.reduce((s, f) => s + f.reporting, 0);
  const totals = {
    factories: byFactory.length,
    lines: byFactory.reduce((s, f) => s + f.lineCount, 0),
    reporting: reportingTotal,
    target: byFactory.reduce((s, f) => s + f.target, 0),
    achieved: achievedTotal,
    projected: byFactory.reduce((s, f) => s + f.projected, 0),
    defects: rows.reduce((s, r) => s + r.totalDefects, 0),
    avgEff: reportingTotal ? +(byFactory.reduce((s, f) => s + f.avgEff * f.reporting, 0) / reportingTotal).toFixed(1) : 0,
    dhu: achievedTotal > 0 ? +((rows.reduce((s, r) => s + r.totalDefects, 0) * 100) / achievedTotal).toFixed(1) : 0,
  };

  return { date: date.toISOString().slice(0, 10), factories: byFactory, totals };
}

/** Defect analytics (Pareto by code + worst lines) across the user's scope. */
export async function getDefectAnalytics(user: AuthUser, date: Date, factoryId?: string) {
  const plans = await plansForScope(user, date, factoryId);
  const codes = await prisma.defectCode.findMany();
  const nameByCode = new Map(codes.map((c) => [c.code, c.name]));

  const byCodeMap = new Map<string, number>();
  const byLine = plans.map((p) => {
    let defects = 0;
    let checked = 0;
    p.entries.forEach((e) => {
      checked += e.checkedQty;
      e.defects.forEach((d) => {
        defects += d.count;
        byCodeMap.set(d.code, (byCodeMap.get(d.code) ?? 0) + d.count);
      });
    });
    return {
      lineId: p.lineId, line: p.line.name, factory: p.line.factory.code,
      checked, defects, dhu: checked > 0 ? +((defects * 100) / checked).toFixed(1) : 0,
    };
  });

  const byCode = [...byCodeMap.entries()]
    .map(([code, count]) => ({ code, name: nameByCode.get(code) ?? code, count }))
    .sort((a, b) => b.count - a.count);

  const totalDefects = byCode.reduce((s, c) => s + c.count, 0);
  const totalChecked = byLine.reduce((s, l) => s + l.checked, 0);

  return {
    date: date.toISOString().slice(0, 10),
    totals: { defects: totalDefects, checked: totalChecked, dhu: totalChecked > 0 ? +((totalDefects * 100) / totalChecked).toFixed(1) : 0 },
    byCode,
    byLine: byLine.filter((l) => l.defects > 0).sort((a, b) => b.dhu - a.dhu),
  };
}

export async function getLineBoard(lineId: string, date: Date) {
  const line = await prisma.line.findUnique({ where: { id: lineId }, include: { factory: true } });
  if (!line) throw new AppError(404, 'Line not found');

  const plan = await prisma.workStudyPlan.findUnique({ where: { lineId_date: { lineId, date } }, ...planInclude });
  const head = { lineId, line: line.name, factoryId: line.factoryId, factory: line.factory.code, factoryName: line.factory.name, date: date.toISOString().slice(0, 10) };

  if (!plan) return { ...head, plan: null, metrics: null, hourLabels: HOUR_LABELS };

  const m = metricsFor(plan);
  return {
    ...head,
    plan: {
      buyer: plan.buyerName, style: plan.style, smv: plan.smv, manpower: plan.manpower,
      dayTarget: plan.dayTarget, plannedHours: plan.plannedHours,
    },
    metrics: m,
    hourLabels: HOUR_LABELS,
  };
}
