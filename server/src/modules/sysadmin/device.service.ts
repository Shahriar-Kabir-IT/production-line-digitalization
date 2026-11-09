import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/http';

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
 * Register/refresh the device and return its lock state.
 * The lock is anchored to this PC's own device id (a token kept in the browser),
 * NOT to its IP — behind a NAT/router many PCs share one public IP, so an IP anchor
 * would lock every PC at once. `ipAddress` is kept for display only.
 */
export async function getOrRegisterDevice(deviceId: string, ip: string, name?: string) {
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, lastSeen: new Date() },
  });
  const device = await prisma.device.findUnique({ where: { id: deviceId }, ...deviceInclude });
  return serialize(device);
}

/** Station PC locks itself to one line (this device only). */
export async function lockDevice(deviceId: string, lineId: string, ip: string, name?: string) {
  const line = await prisma.line.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Line not found');
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { locked: true, lockedLineId: lineId, lockedPmId: null, lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, locked: true, lockedLineId: lineId, lastSeen: new Date() },
  });
  const d = await prisma.device.findUnique({ where: { id: deviceId }, ...deviceInclude });
  return serialize(d);
}

/** PM-board TV locks itself to one Production Manager (this device only). */
export async function lockDeviceToPm(deviceId: string, pmId: string, ip: string, name?: string) {
  const pm = await prisma.user.findFirst({ where: { id: pmId, role: 'PRODUCTION_MANAGER' } });
  if (!pm) throw new AppError(404, 'Production Manager not found');
  await prisma.device.upsert({
    where: { id: deviceId },
    update: { locked: true, lockedPmId: pmId, lockedLineId: null, lastSeen: new Date(), ipAddress: ip, ...(name ? { name } : {}) },
    create: { id: deviceId, name: name ?? null, ipAddress: ip, locked: true, lockedPmId: pmId, lastSeen: new Date() },
  });
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
  await prisma.device.update({ where: { id }, data: { locked: false, lockedLineId: null, lockedPmId: null } });
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
