import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { requireAuth, requireRole } from '../../middleware/auth';
import { listDevices, unlockDevice, adminLockDevice, renameDevice, deleteDevice } from './device.service';
import { audit, userActor } from '../../lib/audit';

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

sysadminRouter.post('/devices/:id/unlock', asyncHandler(async (req, res) => {
  const out = await unlockDevice(req.params.id);
  await audit(userActor(req), 'DEVICE_UNLOCK', { entity: 'Device', entityId: req.params.id, summary: `Unlocked station device ${out?.name ? `"${out.name}"` : req.params.id}` });
  res.json(out);
}));

const lockBody = z.object({ lineId: z.string().min(1) });
sysadminRouter.post('/devices/:id/lock', asyncHandler(async (req, res) => {
  const { lineId } = lockBody.parse(req.body);
  const out = await adminLockDevice(req.params.id, lineId);
  await audit(userActor(req), 'DEVICE_LOCK', { entity: 'Device', entityId: req.params.id, summary: `Locked station device ${out?.name ? `"${out.name}"` : req.params.id} to line ${out?.line ?? lineId}`, meta: { lineId } });
  res.json(out);
}));

const nameBody = z.object({ name: z.string().min(1).max(80) });
sysadminRouter.patch('/devices/:id', asyncHandler(async (req, res) => {
  const { name } = nameBody.parse(req.body);
  const out = await renameDevice(req.params.id, name);
  await audit(userActor(req), 'DEVICE_RENAME', { entity: 'Device', entityId: req.params.id, summary: `Renamed station device to "${name}"`, meta: { name } });
  res.json(out);
}));

sysadminRouter.delete('/devices/:id', asyncHandler(async (req, res) => {
  const out = await deleteDevice(req.params.id);
  await audit(userActor(req), 'DEVICE_DELETE', { entity: 'Device', entityId: req.params.id, summary: `Removed station device ${req.params.id}` });
  res.json(out);
}));

// ---------------------------------------------------------------------------
// User management — create/edit/remove the people who can log in.
// Roles that are scoped to a single factory must carry a factoryId.
// ---------------------------------------------------------------------------
const MANAGED_ROLES = ['SUPER_ADMIN', 'EXECUTIVE', 'WORK_STUDY', 'SYS_ADMIN', 'PRODUCTION_MANAGER'] as const;
const needsFactory = (r: string) => r === 'WORK_STUDY' || r === 'PRODUCTION_MANAGER';

sysadminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { username: 'asc' }],
      include: { factory: { select: { code: true } }, managedLines: { select: { id: true } } },
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        factoryId: u.factoryId,
        factoryCode: u.factory?.code ?? null,
        managedLineIds: u.managedLines.map((l) => l.id),
        managedLines: u.managedLines.length,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
  }),
);

const createBody = z.object({
  username: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash, underscore only'),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(4).max(100),
  role: z.enum(MANAGED_ROLES),
  factoryId: z.string().nullish(),
});

sysadminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const b = createBody.parse(req.body);
    const username = b.username.toLowerCase();
    let factoryId: string | null = null;
    if (needsFactory(b.role)) {
      if (!b.factoryId) throw new AppError(400, 'This role must be assigned to a factory');
      const f = await prisma.factory.findUnique({ where: { id: b.factoryId } });
      if (!f) throw new AppError(400, 'Factory not found');
      factoryId = f.id;
    }
    if (await prisma.user.findUnique({ where: { username } })) throw new AppError(409, 'Username already taken');
    const passwordHash = await bcrypt.hash(b.password, 10);
    const u = await prisma.user.create({ data: { username, name: b.name, passwordHash, role: b.role as Role, factoryId } });
    await audit(userActor(req), 'USER_CREATE', { entity: 'User', entityId: u.id, summary: `Created user "${username}" (${b.name}) as ${b.role}`, meta: { username, name: b.name, role: b.role, factoryId } });
    res.status(201).json({ id: u.id });
  }),
);

const patchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(MANAGED_ROLES).optional(),
  factoryId: z.string().nullish(),
  isActive: z.boolean().optional(),
  password: z.string().min(4).max(100).optional(),
});

// Guard: never let the last active System Administrator be demoted/disabled/removed.
async function assertNotLastSysadmin(targetId: string) {
  const others = await prisma.user.count({ where: { role: Role.SYS_ADMIN, isActive: true, id: { not: targetId } } });
  if (others === 0) throw new AppError(400, 'At least one active System Administrator must remain');
}

sysadminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const b = patchBody.parse(req.body);
    const me = req.user!;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError(404, 'User not found');

    const nextRole = (b.role ?? target.role) as string;
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = b.name;
    if (b.password) data.passwordHash = await bcrypt.hash(b.password, 10);
    if (b.role !== undefined) data.role = b.role;

    if (b.role !== undefined || b.factoryId !== undefined) {
      if (needsFactory(nextRole)) {
        const fid = b.factoryId ?? target.factoryId;
        if (!fid) throw new AppError(400, 'This role must be assigned to a factory');
        const f = await prisma.factory.findUnique({ where: { id: fid } });
        if (!f) throw new AppError(400, 'Factory not found');
        data.factoryId = f.id;
      } else {
        data.factoryId = null;
      }
    }

    if (b.isActive !== undefined) {
      if (!b.isActive && target.id === me.id) throw new AppError(400, 'You cannot deactivate your own account');
      data.isActive = b.isActive;
    }

    // Protect the last sysadmin from a role change or deactivation that would lock everyone out.
    if (target.role === Role.SYS_ADMIN && ((b.role && b.role !== 'SYS_ADMIN') || b.isActive === false)) {
      await assertNotLastSysadmin(target.id);
    }

    await prisma.user.update({ where: { id: target.id }, data });
    const changes: string[] = [];
    if (b.name !== undefined && b.name !== target.name) changes.push(`name → "${b.name}"`);
    if (b.role !== undefined && b.role !== target.role) changes.push(`role → ${b.role}`);
    if (b.factoryId !== undefined && data.factoryId !== target.factoryId) changes.push('factory reassigned');
    if (b.isActive !== undefined && b.isActive !== target.isActive) changes.push(b.isActive ? 'reactivated' : 'deactivated');
    if (b.password) changes.push('password reset');
    await audit(userActor(req), 'USER_UPDATE', { entity: 'User', entityId: target.id, summary: `Updated user "${target.username}"${changes.length ? ` — ${changes.join(', ')}` : ''}`, meta: { changes } });
    res.json({ ok: true });
  }),
);

sysadminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const me = req.user!;
    if (req.params.id === me.id) throw new AppError(400, 'You cannot delete your own account');
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError(404, 'User not found');
    if (target.role === Role.SYS_ADMIN) await assertNotLastSysadmin(target.id);
    await prisma.user.delete({ where: { id: target.id } }); // optional FKs (plans, lines, devices) set null automatically
    await audit(userActor(req), 'USER_DELETE', { entity: 'User', entityId: target.id, summary: `Deleted user "${target.username}" (${target.name}, ${target.role})`, meta: { username: target.username, role: target.role } });
    res.json({ ok: true });
  }),
);

// Set the exact set of lines a Production Manager owns (replaces the previous set).
const linesBody = z.object({ lineIds: z.array(z.string()).default([]) });
sysadminRouter.patch(
  '/users/:id/lines',
  asyncHandler(async (req, res) => {
    const { lineIds } = linesBody.parse(req.body);
    const pm = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!pm) throw new AppError(404, 'User not found');
    if (pm.role !== Role.PRODUCTION_MANAGER) throw new AppError(400, 'Only Production Managers can be assigned lines');
    await prisma.$transaction([
      prisma.line.updateMany({ where: { pmUserId: pm.id }, data: { pmUserId: null } }),
      ...(lineIds.length ? [prisma.line.updateMany({ where: { id: { in: lineIds }, factoryId: pm.factoryId ?? undefined }, data: { pmUserId: pm.id } })] : []),
    ]);
    await audit(userActor(req), 'PM_LINES_SET', { entity: 'User', entityId: pm.id, summary: `Set ${lineIds.length} line${lineIds.length === 1 ? '' : 's'} for Production Manager "${pm.name}"`, meta: { lineIds } });
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Audit trail — read the append-only log (for the on-screen view + PDF export).
// ---------------------------------------------------------------------------
const AUDIT_MAX = 20000;
sysadminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const parseDay = (v: unknown, end: boolean): Date | undefined => {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      return new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}`);
    };
    const gte = parseDay(req.query.from, false);
    const lte = parseDay(req.query.to, true);
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
    const where = {
      ...(gte || lte ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
      ...(action ? { action } : {}),
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: AUDIT_MAX }),
    ]);
    res.json({
      total,
      capped: total > AUDIT_MAX,
      max: AUDIT_MAX,
      logs: logs.map((l) => ({
        id: l.id,
        at: l.createdAt,
        actorType: l.actorType,
        actorName: l.actorName,
        actorRole: l.actorRole,
        ip: l.ip,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        summary: l.summary,
      })),
    });
  }),
);
