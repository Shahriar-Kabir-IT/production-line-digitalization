import type { Status } from '../api/types';

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
export const pct = (n: number | null | undefined) => `${(n ?? 0).toFixed(1)}%`;

export const statusLabel: Record<Status, string> = { good: 'On Target', warn: 'Watch', crit: 'Behind' };

export const facVar = (code: string) => `var(--f-${code})`;

export function todayStr(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
