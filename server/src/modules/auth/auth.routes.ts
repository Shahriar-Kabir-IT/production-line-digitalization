import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, AppError } from '../../utils/http';
import { requireAuth, signToken, AuthUser } from '../../middleware/auth';

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
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !user.isActive) throw new AppError(401, 'Invalid username or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError(401, 'Invalid username or password');

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      factoryId: user.factoryId,
      lineId: user.lineId,
    };
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
