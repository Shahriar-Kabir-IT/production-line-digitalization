import { Request } from 'express';
import { prisma } from './prisma';
import { clientIp } from './ip';

/**
 * Append-only audit trail. We record administrative and security-relevant events
 * (sign-ins, user/device management, plan edits, kiosk config) — NOT the high-volume
 * QC taps, which would bury the signal. Writes never throw: an audit failure must
 * never break the user's request.
 */

export type Actor = {
  actorType: 'USER' | 'DEVICE' | 'SYSTEM';
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  ip?: string | null;
};

/** Actor derived from an authenticated request. */
export function userActor(req: Request): Actor {
  const u = req.user;
  if (!u) return { actorType: 'SYSTEM', ip: clientIp(req) };
  return { actorType: 'USER', actorId: u.id, actorName: u.name || u.username, actorRole: u.role, ip: clientIp(req) };
}

/** Actor for a no-login kiosk (station / TV board). */
export function deviceActor(req: Request, deviceId?: string | null, name?: string | null): Actor {
  return { actorType: 'DEVICE', actorId: deviceId ?? null, actorName: name ?? 'Station device', ip: clientIp(req) };
}

type AuditOpts = {
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: unknown;
};

export async function audit(actor: Actor, action: string, opts: AuditOpts): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId ?? null,
        actorName: actor.actorName ?? null,
        actorRole: actor.actorRole ?? null,
        ip: actor.ip ?? null,
        action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        summary: opts.summary,
        meta: opts.meta === undefined ? undefined : (opts.meta as object),
      },
    });
  } catch (e) {
    // Audit must never break the request it describes.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record', action, e);
  }
}
