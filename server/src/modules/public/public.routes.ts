import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { normalizeDate, getLineBoard, listPms, getPmDashboard } from '../dashboard/dashboard.service';
import { Role } from '@prisma/client';
import { getStation, adjustCheck, adjustDefect } from './station.service';
import { getOrRegisterDevice, lockDevice, lockDeviceToPm } from '../sysadmin/device.service';
import { clientIp } from '../../lib/ip';

// No-login kiosk endpoints: the QC station and the TV board.
export const publicRouter = Router();

publicRouter.get(
  '/factories',
  asyncHandler(async (_req, res) => {
    const factories = await prisma.factory.findMany({
      orderBy: { code: 'asc' },
      include: { lines: { orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } } },
    });
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
