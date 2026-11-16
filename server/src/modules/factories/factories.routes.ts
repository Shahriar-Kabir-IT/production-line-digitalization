import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/http';
import { requireAuth } from '../../middleware/auth';
import { factoryRank, lineAllocRank } from '../../lib/constants';

export const factoriesRouter = Router();

// Factories + their lines, scoped to what the user may see.
factoriesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const where =
      user.role === Role.SUPER_ADMIN ? {} : user.factoryId ? { id: user.factoryId } : { id: '__none__' };
    const factories = (await prisma.factory.findMany({
      where,
      include: { lines: { select: { id: true, name: true, isActive: true } } },
    })).sort((a, b) => factoryRank(a.code) - factoryRank(b.code));
    factories.forEach((f) => f.lines.sort((x, y) => lineAllocRank(f.code, x.name) - lineAllocRank(f.code, y.name)));
    res.json({ factories });
  }),
);
