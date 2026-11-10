import { prisma } from '../../lib/prisma';
import { HOUR_LABELS } from '../../lib/constants';
import { AppError } from '../../utils/http';
import { hourState, isHourEditable, nowInFactoryTz } from '../../lib/lock';
import { normalizeDate, planInclude, metricsFor, getLineBoard } from '../dashboard/dashboard.service';
import { emitLineUpdate } from '../../lib/socket';

function dateStrOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getStation(lineId: string, dateInput?: string) {
  const line = await prisma.line.findUnique({ where: { id: lineId }, include: { factory: true } });
  if (!line) throw new AppError(404, 'Line not found');

  const dateStr = dateInput || nowInFactoryTz().dateStr;
  const date = normalizeDate(dateStr);

  const [plan, codes] = await Promise.all([
    prisma.workStudyPlan.findUnique({ where: { lineId_date: { lineId, date } }, ...planInclude }),
    prisma.defectCode.findMany({ where: { active: true, custom: false }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const head = {
    lineId, line: line.name, factoryId: line.factoryId, factory: line.factory.code, factoryName: line.factory.name,
    date: dateStr,
    now: nowInFactoryTz(),
    defectCodes: codes.map((c) => ({ code: c.code, name: c.name })),
  };

  if (!plan) return { ...head, plan: null, hours: [], metrics: null, hourLabels: HOUR_LABELS, openHourIndex: -1 };

  const entryByIndex = new Map(plan.entries.map((e) => [e.hourIndex, e]));
  const planHourLabels = HOUR_LABELS.slice(0, plan.plannedHours);
  let openHourIndex = -1;
  const hours = planHourLabels.map((label, i) => {
    const e = entryByIndex.get(i);
    const defects: Record<string, number> = {};
    let totalDefects = 0;
    e?.defects.forEach((d) => { defects[d.code] = d.count; totalDefects += d.count; });
    const checkedQty = e?.checkedQty ?? 0;
    const state = hourState(dateStr, i);
    if (state === 'open') openHourIndex = i;
    return {
      hourIndex: i, hourLabel: label, checkedQty, defects, totalDefects,
      dhu: checkedQty > 0 ? +((totalDefects * 100) / checkedQty).toFixed(1) : 0,
      state,
    };
  });

  return {
    ...head,
    plan: { buyer: plan.buyerName, style: plan.style, smv: plan.smv, manpower: plan.manpower, dayTarget: plan.dayTarget, plannedHours: plan.plannedHours },
    hours,
    metrics: metricsFor(plan),
    hourLabels: planHourLabels,
    openHourIndex,
  };
}

async function requireEditablePlan(lineId: string, dateStr: string, hourIndex: number) {
  const date = normalizeDate(dateStr);
  const plan = await prisma.workStudyPlan.findUnique({ where: { lineId_date: { lineId, date } } });
  if (!plan) throw new AppError(409, 'No Work Study plan exists for this line today');
  if (hourIndex < 0 || hourIndex >= plan.plannedHours) throw new AppError(400, 'Invalid hour');
  if (!isHourEditable(dateStr, hourIndex)) {
    throw new AppError(423, `The ${HOUR_LABELS[hourIndex]} box is locked — only the current hour can be edited`);
  }
  return { plan, date };
}

async function ensureEntry(planId: string, hourIndex: number) {
  return prisma.hourlyEntry.upsert({
    where: { planId_hourIndex: { planId, hourIndex } },
    update: {},
    create: { planId, hourIndex, hourLabel: HOUR_LABELS[hourIndex], checkedQty: 0 },
  });
}

async function emitAndReturn(lineId: string, dateStr: string) {
  const board = await getLineBoard(lineId, normalizeDate(dateStr));
  emitLineUpdate(lineId, board);
  return getStation(lineId, dateStr);
}

/** Adjust the checked-quantity counter for an hour (delta +1 / -1).
 *  Atomic (GREATEST(0, x+delta)) so concurrent taps never lose a count. */
export async function adjustCheck(lineId: string, dateStr: string, hourIndex: number, delta: number) {
  const { plan } = await requireEditablePlan(lineId, dateStr, hourIndex);
  const entry = await ensureEntry(plan.id, hourIndex);
  await prisma.$executeRaw`
    UPDATE "HourlyEntry" SET "checkedQty" = GREATEST(0, "checkedQty" + ${delta}), "updatedAt" = now()
    WHERE "id" = ${entry.id}`;
  return emitAndReturn(lineId, dateStr);
}

/** Adjust one defect-code count for an hour (delta +1 / -1). Atomic. */
export async function adjustDefect(lineId: string, dateStr: string, hourIndex: number, code: string, delta: number) {
  const { plan } = await requireEditablePlan(lineId, dateStr, hourIndex);
  const defect = await prisma.defectCode.findUnique({ where: { code } });
  if (!defect) throw new AppError(400, 'Unknown defect code');
  const entry = await ensureEntry(plan.id, hourIndex);
  await prisma.hourlyDefect.upsert({
    where: { entryId_code: { entryId: entry.id, code } },
    update: {},
    create: { entryId: entry.id, code, count: 0 },
  });
  await prisma.$executeRaw`
    UPDATE "HourlyDefect" SET "count" = GREATEST(0, "count" + ${delta})
    WHERE "entryId" = ${entry.id} AND "code" = ${code}`;
  return emitAndReturn(lineId, dateStr);
}
