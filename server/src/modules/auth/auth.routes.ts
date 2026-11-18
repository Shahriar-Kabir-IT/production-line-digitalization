import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { requireAuth, signToken, AuthUser } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/ip';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

async function profile(user: AuthUser) {
  const factory = user.factoryId ? await prisma.factory.findUnique({ where: { id: user.factoryId } }) : null;
  return {
    ...user,
    factoryCode: factory?.code ?? null,
    factoryName: factory?.name ?? null,
  };
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const uname = username.toLowerCase();
    const user = await prisma.user.findUnique({ where: { username: uname } });
    const fail = async (why: string) => {
      await audit(
        { actorType: 'USER', actorName: username, ip: clientIp(req) },
        'LOGIN_FAILED',
        { entity: 'Auth', summary: `Failed sign-in for "${username}" — ${why}` },
      );
      throw new AppError(401, 'Invalid username or password');
    };
    if (!user) await fail('unknown username');
    if (!user!.isActive) await fail('account disabled');
    const ok = await bcrypt.compare(password, user!.passwordHash);
    if (!ok) await fail('wrong password');

    const authUser: AuthUser = {
      id: user!.id,
      username: user!.username,
      name: user!.name,
      role: user!.role,
      factoryId: user!.factoryId,
      lineId: user!.lineId,
    };
    await audit(
      { actorType: 'USER', actorId: authUser.id, actorName: authUser.name || authUser.username, actorRole: authUser.role, ip: clientIp(req) },
      'LOGIN',
      { entity: 'Auth', entityId: authUser.id, summary: `${authUser.name || authUser.username} (${authUser.role}) signed in` },
    );
    res.json({ token: signToken(authUser), user: await profile(authUser) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await profile(req.user!) });
  }),
);
