import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/http';
import { normalizeDate, getLineBoard } from '../dashboard/dashboard.service';
import { getStation, adjustCheck, adjustDefect } from './station.service';

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
