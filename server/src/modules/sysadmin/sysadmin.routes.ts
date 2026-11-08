import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/http';
import { requireAuth, requireRole } from '../../middleware/auth';
import { listDevices, unlockDevice, adminLockDevice, renameDevice, deleteDevice } from './device.service';

export const sysadminRouter = Router();
sysadminRouter.use(requireAuth, requireRole(Role.SYS_ADMIN));

// System overview counts.
sysadminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [factories, lines, users, devices, lockedDevices] = await Promise.all([
      prisma.factory.count(),
      prisma.line.count(),
      prisma.user.count(),
      prisma.device.count(),
      prisma.device.count({ where: { locked: true } }),
    ]);
    res.json({ factories, lines, users, devices, lockedDevices });
  }),
);

sysadminRouter.get('/devices', asyncHandler(async (_req, res) => res.json({ devices: await listDevices() })));

sysadminRouter.post('/devices/:id/unlock', asyncHandler(async (req, res) => res.json(await unlockDevice(req.params.id))));

const lockBody = z.object({ lineId: z.string().min(1) });
sysadminRouter.post('/devices/:id/lock', asyncHandler(async (req, res) => {
  const { lineId } = lockBody.parse(req.body);
  res.json(await adminLockDevice(req.params.id, lineId));
}));

const nameBody = z.object({ name: z.string().min(1).max(80) });
sysadminRouter.patch('/devices/:id', asyncHandler(async (req, res) => {
  const { name } = nameBody.parse(req.body);
  res.json(await renameDevice(req.params.id, name));
}));

sysadminRouter.delete('/devices/:id', asyncHandler(async (req, res) => res.json(await deleteDevice(req.params.id))));
