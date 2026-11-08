import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/http';
import { isLoopback } from '../../lib/ip';

const deviceInclude = { include: { lockedLine: { include: { factory: true } }, lockedPm: true } };

function serialize(d: any) {
  const lineTarget = d.lockedLine ? `${d.lockedLine.factory.code} · Line ${d.lockedLine.name}` : null;
  const pmTarget = d.lockedPm ? d.lockedPm.name : null;
  return {
    id: d.id,
    name: d.name,
    ipAddress: d.ipAddress,
    locked: d.locked,
    lockType: d.lockedLineId ? 'line' : d.lockedPmId ? 'pm' : null,
    lockTarget: lineTarget ?? pmTarget,
    // line (station) fields
    lockedLineId: d.lockedLineId,
    line: d.lockedLine ? d.lockedLine.name : null,
    factory: d.lockedLine ? d.lockedLine.factory.code : null,
    factoryName: d.lockedLine ? d.lockedLine.factory.name : null,
    // pm (board) fields
    lockedPmId: d.lockedPmId,
    pmName: pmTarget,
    lastSeen: d.lastSeen,
    createdAt: d.createdAt,
  };
}

/**
 * Register the device and resolve its EFFECTIVE lock.
 * The lock is anchored to the PC's IP: if another device at the same (non-loopback)
 * IP is locked, this device inherits that lock (line or PM) and the stale rows are
 * removed. So clearing browser storage cannot escape the lock.
 */
export async function getOrRegisterDevice(deviceId: string, ip: string, name?: string) {
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, lastSeen: new Date() },
  });

  if (!isLoopback(ip)) {
    const siblings = await prisma.device.findMany({ where: { ipAddress: ip, id: { not: deviceId } } });
    const lockedSibling = siblings.find((s) => s.locked && (s.lockedLineId || s.lockedPmId));
    if (lockedSibling) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { locked: true, lockedLineId: lockedSibling.lockedLineId, lockedPmId: lockedSibling.lockedPmId, name: name ?? lockedSibling.name ?? undefined },
      });
    }
    if (siblings.length) await prisma.device.deleteMany({ where: { ipAddress: ip, id: { not: deviceId } } });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId }, ...deviceInclude });
  return serialize(device);
}

/** Station PC locks itself to one line. */
export async function lockDevice(deviceId: string, lineId: string, ip: string, name?: string) {
  const line = await prisma.line.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Line not found');
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { locked: true, lockedLineId: lineId, lockedPmId: null, lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, locked: true, lockedLineId: lineId, lastSeen: new Date() },
  });
  if (!isLoopback(ip)) await prisma.device.deleteMany({ where: { ipAddress: ip, id: { not: deviceId } } });
  const d = await prisma.device.findUnique({ where: { id: deviceId }, ...deviceInclude });
  return serialize(d);
}

/** PM-board TV locks itself to one Production Manager. */
export async function lockDeviceToPm(deviceId: string, pmId: string, ip: string, name?: string) {
  const pm = await prisma.user.findFirst({ where: { id: pmId, role: 'PRODUCTION_MANAGER' } });
  if (!pm) throw new AppError(404, 'Production Manager not found');
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { locked: true, lockedPmId: pmId, lockedLineId: null, lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, locked: true, lockedPmId: pmId, lastSeen: new Date() },
  });
  if (!isLoopback(ip)) await prisma.device.deleteMany({ where: { ipAddress: ip, id: { not: deviceId } } });
  const d = await prisma.device.findUnique({ where: { id: deviceId }, ...deviceInclude });
  return serialize(d);
}

// ---- SYS_ADMIN operations ----
export async function listDevices() {
  const devices = await prisma.device.findMany({ ...deviceInclude, orderBy: [{ locked: 'desc' }, { lastSeen: 'desc' }] });
  return devices.map(serialize);
}

export async function unlockDevice(id: string) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) throw new AppError(404, 'Device not found');
  const where = device.ipAddress && !isLoopback(device.ipAddress) ? { OR: [{ id }, { ipAddress: device.ipAddress }] } : { id };
  await prisma.device.updateMany({ where, data: { locked: false, lockedLineId: null, lockedPmId: null } });
  const d = await prisma.device.findUnique({ where: { id }, ...deviceInclude });
  return serialize(d);
}

export async function adminLockDevice(id: string, lineId: string) {
  const line = await prisma.line.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Line not found');
  const d = await prisma.device.update({ where: { id }, data: { locked: true, lockedLineId: lineId, lockedPmId: null }, ...deviceInclude });
  return serialize(d);
}

export async function renameDevice(id: string, name: string) {
  const d = await prisma.device.update({ where: { id }, data: { name }, ...deviceInclude });
  return serialize(d);
}

export async function deleteDevice(id: string) {
  await prisma.device.delete({ where: { id } });
  return { ok: true };
}
