import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FACTORY_MAP, DEFECT_CODES } from '../src/lib/constants';

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

  const sysHash = await bcrypt.hash('1234', 10);
  await prisma.user.upsert({
    where: { username: 'sysadmin' },
    update: { passwordHash: sysHash, role: Role.SYS_ADMIN, name: 'System Administrator', isActive: true },
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

  const counts = {
    factories: await prisma.factory.count(),
    lines: await prisma.line.count(),
    defectCodes: await prisma.defectCode.count(),
    buyers: await prisma.buyer.count(),
    users: await prisma.user.count(),
  };
  // eslint-disable-next-line no-console
  console.log('✓ Seed complete', counts, '— login: sysadmin / 1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
