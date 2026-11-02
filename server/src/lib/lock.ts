import { FACTORY_TZ, HOUR_START_24, LOCK_GRACE_MIN } from './constants';

export type HourState = 'locked' | 'open' | 'upcoming';

/** Current wall-clock in the factory timezone. */
export function nowInFactoryTz(now = new Date()): { dateStr: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FACTORY_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const o: Record<string, string> = {};
  parts.forEach((p) => (o[p.type] = p.value));
  return { dateStr: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour) % 24, minute: Number(o.minute) };
}

/**
 * State of an hour box for a given plan date:
 *  - past day → everything locked; future day → everything upcoming
 *  - today → window passed = locked, current window = open, before window = upcoming
 */
export function hourState(planDateStr: string, hourIndex: number, now = new Date()): HourState {
  const { dateStr, hour, minute } = nowInFactoryTz(now);
  if (planDateStr < dateStr) return 'locked';
  if (planDateStr > dateStr) return 'upcoming';
  const start = HOUR_START_24[hourIndex];
  if (start == null) return 'locked';
  const nowMin = hour * 60 + minute;
  const startMin = start * 60;
  const endMin = startMin + 60 + LOCK_GRACE_MIN;
  if (nowMin >= endMin) return 'locked';
  if (nowMin < startMin) return 'upcoming';
  return 'open';
}

export function isHourEditable(planDateStr: string, hourIndex: number, now = new Date()): boolean {
  return hourState(planDateStr, hourIndex, now) === 'open';
}
