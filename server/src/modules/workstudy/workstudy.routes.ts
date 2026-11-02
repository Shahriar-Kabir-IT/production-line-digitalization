import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { requireAuth, requireRole, assertFactoryScope } from '../../middleware/auth';
import { normalizeDate } from '../dashboard/dashboard.service';
import { emitLineUpdate } from '../../lib/socket';

export const workstudyRouter = Router();

const planSchema = z.object({
  lineId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buyerName: z.string().min(1),
  style: z.string().min(1),
  smv: z.number().positive(),
  manpower: z.number().int().positive(),
  dayTarget: z.number().int().positive(),
  plannedHours: z.number().int().min(1).max(14).optional(),
});

// Read the plan for a line/date (null if none yet).
workstudyRouter.get(
  '/',
  requireAuth,
  requireRole(Role.WORK_STUDY, Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const lineId = String(req.query.lineId || '');
    const date = normalizeDate(req.query.date as string | undefined);
    const line = await prisma.line.findUnique({ where: { id: lineId } });
    if (!line) throw new AppError(404, 'Line not found');
    assertFactoryScope(req.user!, line.factoryId);
    const plan = await prisma.workStudyPlan.findUnique({ where: { lineId_date: { lineId, date } } });
    res.json({ plan });
  }),
);

// Create or update the daily plan (Work Study input).
workstudyRouter.post(
  '/',
  requireAuth,
  requireRole(Role.WORK_STUDY, Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const body = planSchema.parse(req.body);
    const line = await prisma.line.findUnique({ where: { id: body.lineId } });
    if (!line) throw new AppError(404, 'Line not found');
    assertFactoryScope(req.user!, line.factoryId);

    const date = normalizeDate(body.date);
    const buyer = await prisma.buyer.upsert({
      where: { name: body.buyerName },
      update: {},
      create: { name: body.buyerName },
    });

    const data = {
      buyerName: body.buyerName,
      buyerId: buyer.id,
      style: body.style,
      smv: body.smv,
      manpower: body.manpower,
      dayTarget: body.dayTarget,
      plannedHours: body.plannedHours ?? 11,
      authorId: req.user!.id,
    };

    const plan = await prisma.workStudyPlan.upsert({
      where: { lineId_date: { lineId: body.lineId, date } },
      update: data,
      create: { lineId: body.lineId, date, ...data },
    });

    await prisma.auditLog.create({
      data: { actorId: req.user!.id, action: 'UPSERT_PLAN', entity: 'WorkStudyPlan', entityId: plan.id },
    });
    emitLineUpdate(body.lineId, { type: 'plan' });
    res.json({ plan });
  }),
);
