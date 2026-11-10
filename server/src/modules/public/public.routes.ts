import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { normalizeDate, getLineBoard, listPms, getPmDashboard } from '../dashboard/dashboard.service';
import { Role } from '@prisma/client';
import { getStation, adjustCheck, adjustDefect } from './station.service';
import { getOrRegisterDevice, lockDevice, lockDeviceToPm } from '../sysadmin/device.service';
import { clientIp } from '../../lib/ip';
import { factoryRank } from '../../lib/constants';

// No-login kiosk endpoints: the QC station and the TV board.
export const publicRouter = Router();

publicRouter.get(
  '/factories',
  asyncHandler(async (_req, res) => {
    const factories = (await prisma.factory.findMany({
      include: { lines: { orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } } },
    })).sort((a, b) => factoryRank(a.code) - factoryRank(b.code));
    res.json({ factories });
  }),
);

publicRouter.get(
  '/defect-codes',
  asyncHandler(async (_req, res) => {
    const codes = await prisma.defectCode.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ codes });
  }),
);

// Add an ad-hoc defect code from a station (kiosk). Created as `custom` so it stays
// off the standard grid on every station, but Work Study / dashboards still resolve
// its name in analytics. The creating device remembers it locally to show the button.
const newCodeSchema = z.object({
  code: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9/\-]+$/, 'Use letters, numbers, - or /'),
  name: z.string().trim().min(1).max(60),
});
publicRouter.post(
  '/defect-codes',
  asyncHandler(async (req, res) => {
    const { code, name } = newCodeSchema.parse(req.body);
    const CODE = code.toUpperCase();
    const existing = await prisma.defectCode.findUnique({ where: { code: CODE } });
    if (existing) {
      if (!existing.custom) throw new AppError(409, `"${CODE}" is already a standard defect — pick it from the list`);
      return res.json({ code: existing.code, name: existing.name, reused: true });
    }
    const max = await prisma.defectCode.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.defectCode.create({
      data: { code: CODE, name, custom: true, active: true, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    res.status(201).json({ code: created.code, name: created.name });
  }),
);

// TV board (read-only, public display).
publicRouter.get(
  '/board/:lineId',
  asyncHandler(async (req, res) => {
    res.json(await getLineBoard(req.params.lineId, normalizeDate(req.query.date as string | undefined)));
  }),
);

// PM boards (public TV): list PMs, and one PM's dashboard.
publicRouter.get('/pms', asyncHandler(async (_req, res) => res.json({ pms: await listPms() })));

publicRouter.get(
  '/pm/:pmId/dashboard',
  asyncHandler(async (req, res) => {
    const pm = await prisma.user.findFirst({ where: { id: req.params.pmId, role: Role.PRODUCTION_MANAGER } });
    if (!pm) throw new AppError(404, 'Production Manager not found');
    res.json(await getPmDashboard({ id: pm.id, name: pm.name, factoryId: pm.factoryId }, normalizeDate(req.query.date as string | undefined)));
  }),
);

// QC station snapshot (plan, per-hour counters/defects, lock state, defect codes).
publicRouter.get(
  '/station/:lineId',
  asyncHandler(async (req, res) => {
    res.json(await getStation(req.params.lineId, req.query.date as string | undefined));
  }),
);

const checkSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hourIndex: z.number().int().min(0), delta: z.number().int() });
publicRouter.post(
  '/station/:lineId/check',
  asyncHandler(async (req, res) => {
    const b = checkSchema.parse(req.body);
    res.json(await adjustCheck(req.params.lineId, b.date, b.hourIndex, b.delta));
  }),
);

const defectSchema = checkSchema.extend({ code: z.string().min(1).max(8) });
publicRouter.post(
  '/station/:lineId/defect',
  asyncHandler(async (req, res) => {
    const b = defectSchema.parse(req.body);
    res.json(await adjustDefect(req.params.lineId, b.date, b.hourIndex, b.code, b.delta));
  }),
);

// ---- device (kiosk) lock ----
const deviceIdSchema = z.string().min(6).max(80);

// Register / refresh this station device and return its lock state.
publicRouter.get(
  '/device/:deviceId',
  asyncHandler(async (req, res) => {
    const id = deviceIdSchema.parse(req.params.deviceId);
    res.json(await getOrRegisterDevice(id, clientIp(req), typeof req.query.name === 'string' ? req.query.name : undefined));
  }),
);

// Station locks itself to a line (only a SYS_ADMIN can unlock later).
const lockSchema = z.object({ lineId: z.string().min(1), name: z.string().max(80).optional() });
publicRouter.post(
  '/device/:deviceId/lock',
  asyncHandler(async (req, res) => {
    const id = deviceIdSchema.parse(req.params.deviceId);
    const b = lockSchema.parse(req.body);
    res.json(await lockDevice(id, b.lineId, clientIp(req), b.name));
  }),
);

// PM-board TV locks itself to a Production Manager (only a SYS_ADMIN can unlock).
const lockPmSchema = z.object({ pmId: z.string().min(1), name: z.string().max(80).optional() });
publicRouter.post(
  '/device/:deviceId/lock-pm',
  asyncHandler(async (req, res) => {
    const id = deviceIdSchema.parse(req.params.deviceId);
    const b = lockPmSchema.parse(req.body);
    res.json(await lockDeviceToPm(id, b.pmId, clientIp(req), b.name));
  }),
);
