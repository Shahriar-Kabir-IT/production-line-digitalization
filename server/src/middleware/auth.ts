import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/http';
import { prisma } from '../lib/prisma';

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  factoryId: string | null;
  lineId: string | null;
};

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Verify the token, then load the user fresh from the DB so role/scope changes
// take effect immediately and stale tokens (e.g. for deleted users) are rejected.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Missing bearer token');
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { id: string } & jwt.JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) throw new AppError(401, 'Session no longer valid — please sign in again');
    req.user = {
      id: user.id, username: user.username, name: user.name, role: user.role,
      factoryId: user.factoryId, lineId: user.lineId,
    };
    next();
  } catch (e) {
    next(e instanceof AppError ? e : new AppError(401, 'Invalid or expired token'));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'Not authenticated');
    if (!roles.includes(req.user.role)) throw new AppError(403, 'Insufficient permissions');
    next();
  };

/** Super Admin sees all; Work Study only its factory; Line Worker only its line's factory. */
export function assertFactoryScope(user: AuthUser, factoryId: string) {
  if (user.role === Role.SUPER_ADMIN) return;
  if (user.factoryId && user.factoryId === factoryId) return;
  throw new AppError(403, 'Outside your factory scope');
}

/** Line Worker may only touch its own line. */
export function assertLineScope(user: AuthUser, lineId: string, lineFactoryId: string) {
  if (user.role === Role.SUPER_ADMIN) return;
  if (user.role === Role.WORK_STUDY) return assertFactoryScope(user, lineFactoryId);
  if (user.role === Role.LINE_WORKER && user.lineId === lineId) return;
  throw new AppError(403, 'Outside your line scope');
}
