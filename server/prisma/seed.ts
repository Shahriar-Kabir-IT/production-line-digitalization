import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FACTORY_MAP, HOUR_LABELS, DEFECT_CODES } from '../src/lib/constants';
import { hourState, nowInFactoryTz } from '../src/lib/lock';

const prisma = new PrismaClient();

const BUYERS = ['H&M', 'KMART', 'LC Waikiki', 'S&G', 'ZXY', 'GTGS', 'Zara', 'Primark', 'C&A', 'Lindex', 'Next', 'Decathlon'];
const STYLES = ['JAMES TROUSERS S5', 'RYAN OVERSHIRT S5', 'TINNA TWISTED TAPERED', 'MADISON SKINNY HW AL', 'FERN BARREL HW', 'KEN CROPPED RIPSTOP', 'ROBIN DENIM SHIRT MW', 'CHARLIE CANVAS SHORT', 'DENIM PANT 1', '881559 GIRLS JACKET', 'PNT SKATER', 'BARREL 5PKT WO S4', '92S27SHO452', 'MJ6MP344', '05S27SLE454'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad); t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}
const rint = (r: () => number, a: number, b: number) => Math.floor(r() * (b - a + 1)) + a;
const pick = <T>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

function todayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

async function main() {
  const { dateStr } = nowInFactoryTz();
  const date = todayUtc(dateStr);
  const pwHash = await bcrypt.hash('password', 10);

  for (const b of BUYERS) await prisma.buyer.upsert({ where: { name: b }, update: {}, create: { name: b } });

  for (let i = 0; i < DEFECT_CODES.length; i++) {
    const d = DEFECT_CODES[i];
    await prisma.defectCode.upsert({ where: { code: d.code }, update: { name: d.name, sortOrder: i }, create: { code: d.code, name: d.name, sortOrder: i } });
  }

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: pwHash, role: Role.SUPER_ADMIN },
    create: { username: 'admin', name: 'Master Admin', passwordHash: pwHash, role: Role.SUPER_ADMIN },
  });

  const codes = DEFECT_CODES.map((d) => d.code);

  for (const f of FACTORY_MAP) {
    const factory = await prisma.factory.upsert({ where: { code: f.code }, update: { name: f.name }, create: { code: f.code, name: f.name } });

    await prisma.user.upsert({
      where: { username: `ws.${f.code.toLowerCase()}` },
      update: { factoryId: factory.id, passwordHash: pwHash, role: Role.WORK_STUDY },
      create: { username: `ws.${f.code.toLowerCase()}`, name: `Work Study — ${f.code}`, passwordHash: pwHash, role: Role.WORK_STUDY, factoryId: factory.id },
    });

    for (const lineName of f.lines) {
      const line = await prisma.line.upsert({
        where: { factoryId_name: { factoryId: factory.id, name: lineName } },
        update: {},
        create: { name: lineName, factoryId: factory.id },
      });

      const r = rng(hash(`${f.code}:${lineName}`));
      const smv = +(rint(r, 120, 440) / 10).toFixed(1);
      const manpower = rint(r, 55, 72);
      const perf = 0.52 + r() * 0.4;
      const htOut = (0.78 * manpower * 60) / smv;
      const dayTarget = Math.round((htOut * HOUR_LABELS.length) / 10) * 10;
      const buyerName = pick(r, BUYERS);
      const buyer = await prisma.buyer.findUnique({ where: { name: buyerName } });

      const plan = await prisma.workStudyPlan.upsert({
        where: { lineId_date: { lineId: line.id, date } },
        update: { smv, manpower, dayTarget, buyerName, buyerId: buyer?.id, style: pick(r, STYLES) },
        create: { lineId: line.id, date, buyerName, buyerId: buyer?.id, style: pick(r, STYLES), smv, manpower, dayTarget, plannedHours: HOUR_LABELS.length },
      });

      // seed only hours already locked (in the past), so the live hour stays open & empty
      for (let h = 0; h < HOUR_LABELS.length; h++) {
        if (hourState(dateStr, h) !== 'locked') continue;
        const noise = 0.82 + r() * 0.3;
        const checkedQty = Math.max(0, Math.round((perf * manpower * 60) / smv * noise));
        const entry = await prisma.hourlyEntry.upsert({
          where: { planId_hourIndex: { planId: plan.id, hourIndex: h } },
          update: { checkedQty },
          create: { planId: plan.id, hourIndex: h, hourLabel: HOUR_LABELS[h], checkedQty },
        });
        // defects ≈ 3–8% DHU for the hour, spread across a few codes
        const dhuPct = 3 + r() * 5;
        let remaining = Math.round((checkedQty * dhuPct) / 100);
        const nCodes = rint(r, 1, 3);
        for (let c = 0; c < nCodes && remaining > 0; c++) {
          const code = pick(r, codes);
          const cnt = c === nCodes - 1 ? remaining : rint(r, 1, Math.max(1, Math.ceil(remaining / 2)));
          remaining -= cnt;
          await prisma.hourlyDefect.upsert({
            where: { entryId_code: { entryId: entry.id, code } },
            update: { count: cnt },
            create: { entryId: entry.id, code, count: cnt },
          });
        }
      }
    }
  }

  const counts = {
    factories: await prisma.factory.count(),
    lines: await prisma.line.count(),
    users: await prisma.user.count(),
    defectCodes: await prisma.defectCode.count(),
    plans: await prisma.workStudyPlan.count(),
    entries: await prisma.hourlyEntry.count(),
    defects: await prisma.hourlyDefect.count(),
  };
  // eslint-disable-next-line no-console
  console.log('✓ Seed complete', counts, 'open hour state at', dateStr);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
