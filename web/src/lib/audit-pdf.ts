import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AuditEntry } from '../api/types';

type RGB = [number, number, number];

// ---- action → label / category ---------------------------------------------
const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Sign-in',
  LOGIN_FAILED: 'Sign-in failed',
  USER_CREATE: 'User created',
  USER_UPDATE: 'User updated',
  USER_DELETE: 'User deleted',
  PM_LINES_SET: 'PM lines set',
  DEVICE_LOCK: 'Device locked',
  DEVICE_UNLOCK: 'Device unlocked',
  DEVICE_RENAME: 'Device renamed',
  DEVICE_DELETE: 'Device removed',
  DEVICE_SELF_LOCK: 'Station self-locked',
  DEVICE_SELF_LOCK_PM: 'TV board self-locked',
  DEFECT_CODE_CREATE: 'Defect code added',
  PLAN_CREATE: 'Plan created',
  PLAN_UPDATE: 'Plan updated',
  HOUR_REASON_SET: 'Hour reason set',
  UPSERT_PLAN: 'Plan saved', // legacy
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

type Category = 'Authentication' | 'User Management' | 'Device & Kiosk' | 'Production Planning' | 'Quality & Defects' | 'Other';
const CATEGORY_OF: Record<string, Category> = {
  LOGIN: 'Authentication', LOGIN_FAILED: 'Authentication',
  USER_CREATE: 'User Management', USER_UPDATE: 'User Management', USER_DELETE: 'User Management', PM_LINES_SET: 'User Management',
  DEVICE_LOCK: 'Device & Kiosk', DEVICE_UNLOCK: 'Device & Kiosk', DEVICE_RENAME: 'Device & Kiosk', DEVICE_DELETE: 'Device & Kiosk', DEVICE_SELF_LOCK: 'Device & Kiosk', DEVICE_SELF_LOCK_PM: 'Device & Kiosk',
  PLAN_CREATE: 'Production Planning', PLAN_UPDATE: 'Production Planning', UPSERT_PLAN: 'Production Planning',
  DEFECT_CODE_CREATE: 'Quality & Defects', HOUR_REASON_SET: 'Quality & Defects',
};
const categoryOf = (a: string): Category => CATEGORY_OF[a] ?? 'Other';

const CATEGORY_ORDER: Category[] = ['Authentication', 'User Management', 'Device & Kiosk', 'Production Planning', 'Quality & Defects', 'Other'];
const CATEGORY_COLOR: Record<Category, RGB> = {
  'Authentication': [37, 99, 235],
  'User Management': [124, 58, 237],
  'Device & Kiosk': [13, 148, 136],
  'Production Planning': [217, 119, 6],
  'Quality & Defects': [219, 39, 119],
  'Other': [100, 116, 139],
};

const NAVY: RGB = [16, 33, 70];
const ACCENT: RGB = [37, 99, 235];
const INK: RGB = [31, 41, 55];
const MUTE: RGB = [107, 114, 128];
const DANGER: RGB = [185, 28, 28];
const LINE: RGB = [226, 232, 240];
const WASH: RGB = [248, 250, 252];

// jsPDF's built-in fonts are WinAnsi (Latin-1). Map the few non-Latin glyphs our
// summaries can contain to safe equivalents, so text never garbles or breaks wrapping.
function clean(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[→⟶➔⮕➜]/g, ' -> ') // arrows
    .replace(/[←]/g, ' <- ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, '-') // en dash -> hyphen
    .replace(/[^\u0000-ÿ—]/g, '?'); // keep Latin-1 + em dash
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const actorLabel = (l: AuditEntry) => clean(l.actorName) || (l.actorType === 'DEVICE' ? 'Station device' : l.actorType === 'SYSTEM' ? 'System' : 'Unknown');

export interface AuditPdfInfo {
  from?: string; to?: string; action?: string;
  generatedBy: string;
  total: number; capped: boolean; max: number;
}

// -----------------------------------------------------------------------------

export function buildAuditPdf(logs: AuditEntry[], info: AuditPdfInfo): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;

  // ---- aggregates -----------------------------------------------------------
  const byCategory = new Map<Category, number>();
  const byActor = new Map<string, { name: string; role: string; type: string; count: number; last: string }>();
  const byDay = new Map<string, number>();
  const uniqueActors = new Set<string>();
  const uniqueIps = new Set<string>();
  const failedByUser = new Map<string, { attempts: number; ips: Set<string>; last: string }>();
  let okLogins = 0, failedLogins = 0, adminChanges = 0;

  logs.forEach((l) => {
    const cat = categoryOf(l.action);
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    byDay.set(dayKey(l.at), (byDay.get(dayKey(l.at)) ?? 0) + 1);
    const who = actorLabel(l);
    uniqueActors.add(`${who}|${l.actorType}`);
    if (l.ip) uniqueIps.add(l.ip);
    const akey = `${who}|${l.actorRole ?? ''}|${l.actorType}`;
    const a = byActor.get(akey) ?? { name: who, role: l.actorRole ?? (l.actorType === 'DEVICE' ? 'Kiosk' : '—'), type: l.actorType, count: 0, last: l.at };
    a.count++; if (new Date(l.at) > new Date(a.last)) a.last = l.at;
    byActor.set(akey, a);
    if (l.action === 'LOGIN') okLogins++;
    if (l.action === 'LOGIN_FAILED') {
      failedLogins++;
      const u = clean(l.actorName) || 'unknown';
      const f = failedByUser.get(u) ?? { attempts: 0, ips: new Set<string>(), last: l.at };
      f.attempts++; if (l.ip) f.ips.add(l.ip); if (new Date(l.at) > new Date(f.last)) f.last = l.at;
      failedByUser.set(u, f);
    }
    if (cat === 'User Management' || cat === 'Device & Kiosk' || cat === 'Production Planning' || cat === 'Quality & Defects') adminChanges++;
  });

  // date span
  const times = logs.map((l) => new Date(l.at).getTime());
  const firstAt = times.length ? new Date(Math.min(...times)) : null;
  const lastAt = times.length ? new Date(Math.max(...times)) : null;
  const rangeFrom = info.from ? new Date(`${info.from}T00:00:00`) : firstAt;
  const rangeTo = info.to ? new Date(`${info.to}T00:00:00`) : lastAt;
  const spanDays = rangeFrom && rangeTo ? Math.max(1, Math.round((rangeTo.getTime() - rangeFrom.getTime()) / 86400000) + 1) : 0;

  // ===========================================================================
  // HEADER
  // ===========================================================================
  doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 70, 'F');
  doc.setFillColor(...ACCENT); doc.rect(0, 70, pageW, 3, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('ANANTA', M, 34);
  doc.setTextColor(150, 190, 255); doc.text('· MES', M + doc.getTextWidth('ANANTA') + 8, 34);
  doc.setTextColor(255, 255, 255); doc.setFontSize(12.5); doc.setFont('helvetica', 'normal');
  doc.text('Audit Trail Report', M, 54);
  doc.setFontSize(8.5); doc.setTextColor(190, 205, 230);
  doc.text('Manufacturing Execution System — security & administration log', M, 65);

  const range = info.from || info.to ? `${info.from || '—'}  to  ${info.to || '—'}` : 'All time';
  const metaLines: [string, string][] = [
    ['Generated', fmtDateTime(new Date().toISOString())],
    ['Generated by', clean(info.generatedBy)],
    ['Date range', range],
    ...(info.action ? [['Action filter', actionLabel(info.action)] as [string, string]] : []),
    ['Total events', String(info.total)],
  ];
  doc.setFontSize(8); let my = 20;
  metaLines.forEach(([k, v]) => {
    doc.setTextColor(170, 190, 220); doc.setFont('helvetica', 'normal');
    doc.text(`${k}:`, pageW - M - 160, my);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text(v, pageW - M, my, { align: 'right' });
    my += 11;
  });

  // ===========================================================================
  // EXECUTIVE SUMMARY — KPI CARDS
  // ===========================================================================
  let y = 90;
  sectionTitle(doc, 'Executive summary', M, y);
  y += 12;

  const cards: [string, string, RGB][] = [
    ['Total events', String(info.total), NAVY],
    ['Period', spanDays ? `${spanDays} day${spanDays === 1 ? '' : 's'}` : '—', ACCENT],
    ['Unique actors', String(uniqueActors.size), [124, 58, 237]],
    ['Successful sign-ins', String(okLogins), [13, 148, 136]],
    ['Failed sign-ins', String(failedLogins), failedLogins ? DANGER : [13, 148, 136]],
    ['Admin / config changes', String(adminChanges), [217, 119, 6]],
  ];
  const gap = 10;
  const cw = (pageW - 2 * M - gap * (cards.length - 1)) / cards.length;
  const ch = 50;
  cards.forEach((c, i) => kpiCard(doc, M + i * (cw + gap), y, cw, ch, c[0], c[1], c[2]));
  y += ch + 20;

  // ===========================================================================
  // BAND: Events by category (left)  +  Activity over time (right)
  // ===========================================================================
  const bandY = y;
  const colGap = 24;
  const leftW = (pageW - 2 * M - colGap) * 0.5;
  const rightX = M + leftW + colGap;
  const rightW = pageW - M - rightX;

  // -- left: category bars
  sectionTitle(doc, 'Events by category', M, bandY);
  const catRows = CATEGORY_ORDER.filter((c) => byCategory.get(c)).map((c) => ({ label: c, count: byCategory.get(c) || 0, color: CATEGORY_COLOR[c] }));
  const maxCat = Math.max(1, ...catRows.map((r) => r.count));
  if (catRows.length) hBars(doc, M, bandY + 12, leftW, catRows, maxCat);
  else emptyNote(doc, 'No events in range.', M, bandY + 26);
  const leftH = catRows.length ? catRows.length * 18 + 14 : 30;

  // -- right: activity over time
  sectionTitle(doc, 'Activity over the period', rightX, bandY);
  const days = buildDaySeries(byDay, rangeFrom, rangeTo);
  if (days.length) dayChart(doc, rightX, bandY + 14, rightW, 76, days);
  else emptyNote(doc, 'No events in range.', rightX, bandY + 26);
  const rightH = 90;

  y = bandY + Math.max(leftH, rightH) + 22;

  // ===========================================================================
  // BAND: Most active actors (left)  +  Sign-in security (right), same startY
  // ===========================================================================
  sectionTitle(doc, 'Most active people & devices', M, y);
  sectionTitle(doc, 'Sign-in activity', rightX, y);
  const tableY = y + 8;

  const topActors = [...byActor.values()].sort((a, b) => b.count - a.count).slice(0, 7);
  autoTable(doc, {
    startY: tableY,
    margin: { left: M, right: pageW - (M + leftW) },
    head: [['Actor', 'Role / type', 'Events', 'Last seen']],
    body: topActors.length ? topActors.map((a) => [a.name, a.type === 'USER' ? a.role : a.type === 'DEVICE' ? 'Kiosk device' : 'System', String(a.count), fmtDateTime(a.last)]) : [['—', 'No activity', '0', '—']],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 3, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 2: { halign: 'right', cellWidth: 42 }, 3: { cellWidth: 88 } },
  });
  const leftFinal = (doc as any).lastAutoTable.finalY as number;

  const failRows = [...failedByUser.entries()].sort((a, b) => b[1].attempts - a[1].attempts);
  autoTable(doc, {
    startY: tableY,
    margin: { left: rightX, right: M },
    head: [['Status', 'Detail', 'Count']],
    body: [
      ['Successful', `${okLogins} sign-in${okLogins === 1 ? '' : 's'} by ${new Set(logs.filter((l) => l.action === 'LOGIN').map((l) => l.actorName)).size} account(s)`, String(okLogins)],
      ...(failRows.length
        ? failRows.map(([u, f]) => [`Failed — ${u}`, `${f.ips.size} IP${f.ips.size === 1 ? '' : 's'}, last ${fmtDateTime(f.last)}`, String(f.attempts)])
        : [['Failed', 'No failed sign-in attempts in this period', '0']]),
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 3, textColor: INK, lineColor: LINE, overflow: 'linebreak' },
    headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 96, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 40 } },
    didParseCell: (d) => {
      if (d.section === 'body' && String(d.row.raw && (d.row.raw as any[])[0]).startsWith('Failed —')) d.cell.styles.textColor = DANGER;
    },
  });
  const rightFinal = (doc as any).lastAutoTable.finalY as number;

  // ===========================================================================
  // DETAILED EVENT LOG (own page)
  // ===========================================================================
  doc.addPage();
  sectionTitle(doc, `Detailed event log  (${logs.length}${info.capped ? ` of ${info.total}, most recent shown` : ''})`, M, 40);

  autoTable(doc, {
    startY: 50,
    margin: { left: M, right: M },
    head: [['Date / Time', 'Category', 'Event', 'Actor', 'Role / type', 'Details', 'IP']],
    body: logs.map((l) => [
      fmtDateTime(l.at),
      categoryOf(l.action),
      actionLabel(l.action),
      actorLabel(l),
      l.actorType === 'USER' ? (l.actorRole ?? '—') : l.actorType === 'DEVICE' ? 'Kiosk' : 'System',
      clean(l.summary) || '—',
      l.ip || '—',
    ]),
    theme: 'striped',
    styles: { fontSize: 7.3, cellPadding: 3, textColor: INK, lineColor: [233, 238, 245], overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6 },
    alternateRowStyles: { fillColor: WASH },
    columnStyles: {
      0: { cellWidth: 86 },
      1: { cellWidth: 92 },
      2: { cellWidth: 82 },
      3: { cellWidth: 88 },
      4: { cellWidth: 64 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 72 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const l = logs[data.row.index];
      if (!l) return;
      if (data.column.index === 1) {
        const col = CATEGORY_COLOR[categoryOf(l.action)];
        data.cell.styles.textColor = col; data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 2 && l.action === 'LOGIN_FAILED') data.cell.styles.textColor = DANGER;
      if (data.column.index === 2 && (l.action === 'USER_DELETE' || l.action === 'DEVICE_DELETE')) data.cell.styles.textColor = [194, 65, 12];
    },
  });

  // ===========================================================================
  // FOOTER — every page
  // ===========================================================================
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
    doc.line(M, pageH - 24, pageW - M, pageH - 24);
    doc.setFontSize(7.5); doc.setTextColor(...MUTE); doc.setFont('helvetica', 'normal');
    doc.text('Confidential — Ananta MES audit trail. Generated automatically; events are append-only.', M, pageH - 13);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 13, { align: 'right' });
  }

  // avoid "unused" lints on the two finals (kept for future layout tweaks)
  void leftFinal; void rightFinal;
  return doc;
}

// ---- drawing helpers --------------------------------------------------------
function sectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(text, x, y);
}
function emptyNote(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
  doc.text(text, x, y);
}
function kpiCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, accent: RGB) {
  doc.setFillColor(...WASH); doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, 6, 6, 'FD');
  doc.setFillColor(...accent); doc.roundedRect(x, y, 4, h, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...MUTE);
  // label (uppercase eyebrow)
  doc.setFontSize(6.8); doc.setTextColor(...MUTE);
  doc.text(label.toUpperCase(), x + 12, y + 17);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...accent);
  doc.text(value, x + 12, y + 39);
}
function hBars(doc: jsPDF, x: number, y: number, w: number, rows: { label: string; count: number; color: RGB }[], max: number) {
  const labelW = 118, valW = 34;
  const trackX = x + labelW, trackW = Math.max(40, w - labelW - valW);
  rows.forEach((r, i) => {
    const ry = y + i * 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...INK);
    doc.text(r.label, x, ry + 10);
    doc.setFillColor(237, 242, 247); doc.roundedRect(trackX, ry + 2, trackW, 10, 2, 2, 'F');
    const bw = Math.max(3, (trackW * r.count) / max);
    doc.setFillColor(...r.color); doc.roundedRect(trackX, ry + 2, bw, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...INK);
    doc.text(String(r.count), trackX + trackW + valW, ry + 10, { align: 'right' });
  });
}
function buildDaySeries(byDay: Map<string, number>, from: Date | null, to: Date | null): { date: string; count: number }[] {
  if (!from || !to) {
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  }
  const out: { date: string; count: number }[] = [];
  const d = new Date(from); d.setHours(0, 0, 0, 0);
  const end = new Date(to); end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d <= end && guard < 400) {
    const p = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    out.push({ date: key, count: byDay.get(key) ?? 0 });
    d.setDate(d.getDate() + 1); guard++;
  }
  return out;
}
function dayChart(doc: jsPDF, x: number, y: number, w: number, h: number, days: { date: string; count: number }[]) {
  const baseline = y + h;
  const max = Math.max(1, ...days.map((d) => d.count));
  const n = days.length;
  const slot = w / n;
  const barW = Math.max(2, Math.min(18, slot * 0.68));
  // gridline + max label
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
  doc.line(x, baseline, x + w, baseline);
  doc.setFontSize(6.5); doc.setTextColor(...MUTE); doc.setFont('helvetica', 'normal');
  doc.text(`peak ${max}/day`, x + w, y - 2, { align: 'right' });
  days.forEach((d, i) => {
    const bx = x + i * slot + (slot - barW) / 2;
    const bh = d.count ? Math.max(1.5, ((h - 6) * d.count) / max) : 0;
    if (bh > 0) { doc.setFillColor(...ACCENT); doc.roundedRect(bx, baseline - bh, barW, bh, 1.5, 1.5, 'F'); }
  });
  // first / middle / last date labels
  doc.setFontSize(6.3); doc.setTextColor(...MUTE);
  const shortD = (s: string) => s.slice(5); // MM-DD
  if (n > 0) {
    doc.text(shortD(days[0].date), x, baseline + 9);
    if (n > 2) doc.text(shortD(days[Math.floor(n / 2)].date), x + w / 2, baseline + 9, { align: 'center' });
    doc.text(shortD(days[n - 1].date), x + w, baseline + 9, { align: 'right' });
  }
}
