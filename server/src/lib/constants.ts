// Standard working hours on the floor (11 productive hours).
export const HOUR_LABELS = [
  '8–9', '9–10', '10–11', '11–12', '12–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7',
];
// 24h clock start of each hour slot (used for time-locking).
export const HOUR_START_24 = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export const PLANNED_HOURS = HOUR_LABELS.length;

// Factory timezone — hour-locking is evaluated against this clock.
export const FACTORY_TZ = 'Asia/Dhaka';
// Minutes of grace after an hour ends before its box locks (0 = strict).
export const LOCK_GRACE_MIN = 0;

// Production-Manager allocation (Factory Wise PM Allocation). Line names match the DB.
export const PM_ALLOCATION: { factory: string; pm: string; floor: string; lines: string[] }[] = [
  { factory: 'AGL', pm: 'PM 1', floor: '3rd', lines: ['A', 'B', 'C', 'New-10', 'D', 'E', 'F', 'New-02'] },
  { factory: 'AGL', pm: 'PM 2', floor: '4th', lines: ['G', 'H', 'I', 'New-11', 'J', 'K', 'L', 'New-01'] },
  { factory: 'AGL', pm: 'PM 3', floor: '5th', lines: ['M', 'N', 'O', 'New-12', 'New-15'] },
  { factory: 'ASL', pm: 'PM 4', floor: '5th', lines: ['P', 'Q', 'R', 'New-08'] },
  { factory: 'ASL', pm: 'PM 5', floor: '6th', lines: ['S', 'T', 'U', 'New-09', 'New-16', 'V', 'W', 'X', 'New-03'] },
  { factory: 'ASL', pm: 'PM 6', floor: '7th', lines: ['Y', 'Z', 'New-04', 'New-13', 'New-05', 'New-06', 'New-07', 'New-14'] },
  { factory: 'AJL', pm: 'PM 1', floor: '4th', lines: ['A', 'B', 'C', 'D', 'E', 'F'] },
  { factory: 'AJL', pm: 'PM 2', floor: '5th', lines: ['G', 'H', 'I', 'J', 'K', 'L'] },
  { factory: 'AJL', pm: 'PM 3', floor: '6th', lines: ['M', 'N', 'O', 'P', 'Q', 'R'] },
  { factory: 'AJL', pm: 'PM 4', floor: '7th', lines: ['S', 'T', 'U', 'V', 'W'] },
  { factory: 'ABM', pm: 'PM 1', floor: '3rd–4th', lines: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'] },
  { factory: 'ABM', pm: 'PM 2', floor: '5th', lines: ['17', '18', '19', '20', '21'] },
];
export const pmUsername = (factory: string, pm: string) => `${pm.replace(/\s+/g, '').toLowerCase()}.${factory.toLowerCase()}`;

// Defect-code master (from form Q-SEW006-01). A few faint codes on the scan are
// best-effort; edit names/codes here and re-seed if the controlled list differs.
export const DEFECT_CODES: { code: string; name: string }[] = [
  { code: 'AB', name: 'Uncut Thread' },
  { code: 'B', name: 'Broken Stitch' },
  { code: 'C', name: 'Dirty Spot / Oil Mark' },
  { code: 'D', name: 'Down Stitch' },
  { code: 'E', name: 'Raw-Edge Out' },
  { code: 'F', name: 'Fabric Defects' },
  { code: 'G', name: 'Gathering' },
  { code: 'H', name: 'Hi-Low / Up-Down' },
  { code: 'J', name: 'Joint Stitch' },
  { code: 'L', name: 'Label / Size Mistake' },
  { code: 'MP', name: 'Misplaced' },
  { code: 'N', name: 'Needle Mark' },
  { code: 'NM', name: 'Number Mistake' },
  { code: 'O', name: 'Open Stitch' },
  { code: 'OV', name: 'Over / Short Stitch' },
  { code: 'P', name: 'Puckering' },
  { code: 'PM', name: 'Process Missing' },
  { code: 'PL', name: 'Pleat' },
  { code: 'R', name: 'Raw Stitch' },
  { code: 'RJ', name: 'Reject / Damage' },
  { code: 'RV', name: 'Reverse' },
  { code: 'S', name: 'Shading' },
  { code: 'SK', name: 'Skip Stitch' },
  { code: 'SL', name: 'Slanted' },
  { code: 'T', name: 'Twisting' },
  { code: 'TT', name: 'Thread Tension Loose' },
  { code: 'U', name: 'Uneven Stitch' },
  { code: 'UP', name: 'Unparallel Stitch' },
  { code: 'V', name: 'V-Shape' },
  { code: 'SHP', name: 'Shape' },
  { code: 'Z', name: 'Wave' },
];

// Factory → line map (source of truth for the seed).
export const FACTORY_MAP: { code: string; name: string; lines: string[] }[] = [
  {
    code: 'AGL',
    name: 'Ananta Garments Ltd.',
    lines: ['New-01', 'New-02', 'New-10', 'New-11', 'New-12', 'New-15', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
  },
  {
    code: 'ASL',
    name: 'Ananta Sportswear Ltd.',
    lines: ['New-03', 'New-08', 'New-09', 'New-13', 'New-14', 'New-16', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'New-04', 'New-05', 'New-06', 'New-07'],
  },
  {
    code: 'AJL',
    name: 'Ananta Jeanswear Ltd.',
    lines: ['S', 'T', 'U', 'V', 'W', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
  },
  {
    code: 'ABM',
    name: 'ABM Fashion Ltd.',
    lines: ['1', '2', '3', '4', '5', '9', '10', '11', '12', '13', '17', '18', '19', '20', '21', '6', '7', '8', '14', '15', '16'],
  },
];

// Canonical factory display order — always AGL, ASL, AJL, ABM (the FACTORY_MAP order),
// never alphabetical. Use factoryRank() to sort anything shown to users.
export const FACTORY_SEQUENCE = FACTORY_MAP.map((f) => f.code);
export const factoryRank = (code: string | null | undefined): number => {
  const i = FACTORY_SEQUENCE.indexOf(code ?? '');
  return i < 0 ? 999 : i;
};
