import { PrismaClient, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { PM_ALLOCATION, pmUsername } from '../src/lib/constants';

const prisma = new PrismaClient();

// Sync Production Managers + their line allocation to PM_ALLOCATION, and prune
// allocation PMs that were split/renamed and now own no lines. Safe to re-run;
// leaves manually-created users and all production data untouched.
async function main() {
  const wanted = new Set<string>();
  for (const alloc of PM_ALLOCATION) {
    const factory = await prisma.factory.findUnique({ where: { code: alloc.factory } });
    if (!factory) continue;
    const username = pmUsername(alloc.factory, alloc.pm);
    wanted.add(username);
    const name = `${alloc.pm} — ${alloc.factory}`;
    const pm = await prisma.user.upsert({
      where: { username },
      update: { factoryId: factory.id, role: Role.PRODUCTION_MANAGER, name },
      create: { username, name, passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10), role: Role.PRODUCTION_MANAGER, factoryId: factory.id },
    });
    for (const lineName of alloc.lines) {
      await prisma.line.updateMany({ where: { factoryId: factory.id, name: lineName }, data: { pmUserId: pm.id } });
    }
  }

  // Remove leftover allocation PMs (name "PM … — FACTORY") that are no longer wanted
  // and now manage no lines — e.g. the old combined ABM "PM 1".
  const orphans = await prisma.user.findMany({
    where: { role: Role.PRODUCTION_MANAGER, username: { notIn: [...wanted] }, managedLines: { none: {} } },
  });
  const removable = orphans.filter((o) => /^PM .* — /.test(o.name));
  for (const o of removable) await prisma.user.delete({ where: { id: o.id } });

  const total = await prisma.user.count({ where: { role: Role.PRODUCTION_MANAGER } });
  // eslint-disable-next-line no-console
  console.log(`✓ PMs synced: ${total} total`, removable.length ? `· removed ${removable.map((o) => o.username).join(', ')}` : '');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
