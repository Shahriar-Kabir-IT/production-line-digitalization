import { PrismaClient, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { FACTORY_MAP, DEFECT_CODES, PM_ALLOCATION, pmUsername } from '../src/lib/constants';

const prisma = new PrismaClient();

// Reference buyers available in the Work Study plan dropdown.
const BUYERS = ['H&M', 'KMART', 'LC Waikiki', 'S&G', 'ZXY', 'GTGS', 'Zara', 'Primark', 'C&A', 'Lindex', 'Next', 'Decathlon'];

// Fresh production seed: the factory/line master structure + defect codes + buyers,
// and a single System Administrator login. All other users are created from the
// SysAdmin panel, each with their own username and password.
async function main() {
  for (const b of BUYERS) await prisma.buyer.upsert({ where: { name: b }, update: {}, create: { name: b } });

  for (let i = 0; i < DEFECT_CODES.length; i++) {
    const d = DEFECT_CODES[i];
    await prisma.defectCode.upsert({ where: { code: d.code }, update: { name: d.name, sortOrder: i }, create: { code: d.code, name: d.name, sortOrder: i } });
  }

  // Keep sysadmin present, but never reset a password that may have been changed in production.
  const sysHash = await bcrypt.hash('1234', 10);
  await prisma.user.upsert({
    where: { username: 'sysadmin' },
    update: { role: Role.SYS_ADMIN, name: 'System Administrator', isActive: true },
    create: { username: 'sysadmin', name: 'System Administrator', passwordHash: sysHash, role: Role.SYS_ADMIN },
  });

  for (const f of FACTORY_MAP) {
    const factory = await prisma.factory.upsert({ where: { code: f.code }, update: { name: f.name }, create: { code: f.code, name: f.name } });
    for (const lineName of f.lines) {
      await prisma.line.upsert({
        where: { factoryId_name: { factoryId: factory.id, name: lineName } },
        update: {},
        create: { name: lineName, factoryId: factory.id },
      });
    }
  }

  // Production Managers + their line allocation. The PM board is a NO-LOGIN public
  // kiosk, so each PM is a record used only to hold the lines they're responsible
  // for; they get an unusable random password so no one can sign in as them.
  for (const alloc of PM_ALLOCATION) {
    const factory = await prisma.factory.findUnique({ where: { code: alloc.factory } });
    if (!factory) continue;
    const username = pmUsername(alloc.factory, alloc.pm);
    const name = `${alloc.pm} — ${alloc.factory}`;
    const pmUser = await prisma.user.upsert({
      where: { username },
      update: { factoryId: factory.id, role: Role.PRODUCTION_MANAGER, name },
      create: { username, name, passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10), role: Role.PRODUCTION_MANAGER, factoryId: factory.id },
    });
    for (const lineName of alloc.lines) {
      await prisma.line.updateMany({ where: { factoryId: factory.id, name: lineName }, data: { pmUserId: pmUser.id } });
    }
  }

  const counts = {
    factories: await prisma.factory.count(),
    lines: await prisma.line.count(),
    defectCodes: await prisma.defectCode.count(),
    buyers: await prisma.buyer.count(),
    users: await prisma.user.count(),
    pms: await prisma.user.count({ where: { role: Role.PRODUCTION_MANAGER } }),
    pmLines: await prisma.line.count({ where: { pmUserId: { not: null } } }),
  };
  // eslint-disable-next-line no-console
  console.log('✓ Seed complete', counts, '— login: sysadmin / 1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
