import { PrismaClient } from '@prisma/client';
import { DEFECT_CODES } from '../src/lib/constants';

const prisma = new PrismaClient();

// Sync the DefectCode master table to DEFECT_CODES (names + order), and drop any
// code no longer in the list (plus its recorded defects). Safe to re-run anytime
// the controlled defect list changes; touches only defect data.
async function main() {
  const codes = DEFECT_CODES.map((d) => d.code);

  for (let i = 0; i < DEFECT_CODES.length; i++) {
    const d = DEFECT_CODES[i];
    await prisma.defectCode.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: i, active: true },
      create: { code: d.code, name: d.name, sortOrder: i },
    });
  }

  const removed = await prisma.defectCode.findMany({ where: { code: { notIn: codes } } });
  for (const r of removed) {
    await prisma.hourlyDefect.deleteMany({ where: { code: r.code } });
    await prisma.defectCode.delete({ where: { code: r.code } });
  }

  const all = await prisma.defectCode.findMany({ orderBy: { sortOrder: 'asc' } });
  // eslint-disable-next-line no-console
  console.log(`✓ Defect codes synced: ${all.length} active`, removed.length ? `· removed ${removed.map((r) => r.code).join(', ')}` : '');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
