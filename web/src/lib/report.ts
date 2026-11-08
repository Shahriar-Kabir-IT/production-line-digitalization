import client from '../api/client';

interface ReportHour { hourLabel: string; checked: number; efficiency: number; totalDefects: number; dhu: number; defects: Record<string, number>; }
interface LineReport {
  factory: string; factoryName: string; line: string; date: string;
  plan: { buyer: string; style: string; smv: number; manpower: number; dayTarget: number; plannedHours: number; targetEff: number } | null;
  hours: ReportHour[];
  metrics: { achieved: number; projected: number; avgEff: number; totalDefects: number; totalChecked: number; dhu: number } | null;
  byCode: { code: string; name: string; count: number }[];
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(d: LineReport): string {
  const rows: unknown[][] = [];
  rows.push(['ANANTA MES — Detailed Line Report']);
  rows.push([]);
  rows.push(['Factory', `${d.factory} — ${d.factoryName}`]);
  rows.push(['Line', d.line]);
  rows.push(['Date', d.date]);

  if (!d.plan || !d.metrics) {
    rows.push([]);
    rows.push(['No Work Study plan / production data for this line on this date.']);
  } else {
    rows.push(['Buyer', d.plan.buyer]);
    rows.push(['Style', d.plan.style]);
    rows.push(['SMV', d.plan.smv]);
    rows.push(['Manpower', d.plan.manpower]);
    rows.push(['Day Target', d.plan.dayTarget]);
    rows.push(['Target Efficiency %', d.plan.targetEff]);
    rows.push([]);

    rows.push(['HOURLY DETAIL']);
    rows.push(['Hour', 'Checked', 'Efficiency %', 'Defects', 'DHU %']);
    d.hours.forEach((h) => rows.push([h.hourLabel, h.checked, h.efficiency, h.totalDefects, h.dhu]));
    rows.push(['TOTAL', d.metrics.achieved, d.metrics.avgEff, d.metrics.totalDefects, d.metrics.dhu]);
    rows.push([]);

    rows.push(['PLAN vs ACHIEVED']);
    rows.push(['Day Target', d.plan.dayTarget]);
    rows.push(['Achieved', d.metrics.achieved]);
    rows.push(['Projected EOD', d.metrics.projected]);
    rows.push(['Avg Efficiency %', d.metrics.avgEff]);
    rows.push(['Total Checked', d.metrics.totalChecked]);
    rows.push(['Total Defects', d.metrics.totalDefects]);
    rows.push(['Line DHU %', d.metrics.dhu]);
    rows.push([]);

    rows.push(['DEFECTS BY CODE']);
    rows.push(['Code', 'Defect', 'Count']);
    if (d.byCode.length === 0) rows.push(['—', 'No defects recorded', 0]);
    else d.byCode.forEach((c) => rows.push([c.code, c.name, c.count]));
  }

  rows.push([]);
  rows.push(['Generated', new Date().toLocaleString()]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Fetch a line's detailed report and trigger a CSV download. */
export async function downloadLineReport(lineId: string, date: string): Promise<void> {
  const { data } = await client.get<LineReport>(`/dashboard/line/${lineId}/report`, { params: { date } });
  const csv = '﻿' + buildCsv(data); // BOM so Excel reads UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MES_${data.factory}_Line-${data.line}_${data.date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
