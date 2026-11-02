import type { Status } from '../api/types';

const statusColor: Record<Status, string> = { good: '#0f8a5b', warn: '#a96a06', crit: '#cc3a3a' };

export default function Gauge({ value, targetEff, status }: { value: number; targetEff: number; status: Status }) {
  const R = 86;
  const CX = 100;
  const CY = 100;
  const circ = Math.PI * R;
  const pct = Math.max(0, Math.min(100, value));
  const off = circ * (1 - pct / 100);
  const col = statusColor[status];
  const tx = Math.max(0, Math.min(100, targetEff)) / 100;
  const ang = Math.PI * (1 - tx);
  const mx = CX + R * Math.cos(ang);
  const my = CY - R * Math.sin(ang);
  const ix = CX + (R - 13) * Math.cos(ang);
  const iy = CY - (R - 13) * Math.sin(ang);

  return (
    <svg viewBox="0 0 200 122" width="100%" role="img" aria-label={`Efficiency ${value}%`}>
      <path d="M14 100 A86 86 0 0 1 186 100" fill="none" stroke="#e7ecf4" strokeWidth="15" strokeLinecap="round" />
      <path
        d="M14 100 A86 86 0 0 1 186 100"
        fill="none" stroke={col} strokeWidth="15" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <line x1={ix} y1={iy} x2={mx} y2={my} stroke="#131d2e" strokeWidth="2.5" />
      <text x={mx} y={my - 7} fill="#4e5d77" fontSize="9" textAnchor="middle" fontFamily="IBM Plex Mono">TGT {targetEff.toFixed(0)}</text>
      <text x="100" y="92" textAnchor="middle" fontFamily="Barlow Semi Condensed" fontWeight="700" fontSize="42" fill={col}>{value.toFixed(1)}</text>
      <text x="100" y="112" textAnchor="middle" fontSize="10" letterSpacing="2" fill="#8794ab">PERCENT</text>
    </svg>
  );
}
