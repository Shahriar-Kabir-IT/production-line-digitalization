import { Line, Bar, Doughnut } from 'react-chartjs-2';
import type { ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import { C, font, palette, tooltipStyle, targetLinePlugin, vGradient, doughnutCenter } from './chartSetup';

const baseScales = (yCallback?: (v: number) => string) => ({
  x: { grid: { display: false }, border: { display: false }, ticks: { color: C.ink3, font } },
  y: {
    beginAtZero: true,
    grid: { color: C.grid, drawTicks: false },
    border: { display: false, dash: [3, 3] },
    ticks: { color: C.ink3, font, padding: 8, callback: (v: number | string) => (yCallback ? yCallback(Number(v)) : v) },
  },
});

const kfmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v));

// Per-bar vertical gradient from a list of base colors.
const barGrad = (colors: string[], alphaBottom = 'c0') =>
  (ctx: ScriptableContext<'bar'>) => vGradient(ctx.chart, colors[ctx.dataIndex] ?? C.brand, 'ff', alphaBottom);

const BAR = { borderRadius: 7, borderSkipped: false as const };

/** Target Against Achieved — cumulative achieved vs required pace. */
export function TargetAchievedChart({ labels, pace, cumulative, color, suggestedMax }: {
  labels: string[]; pace: number[]; cumulative: (number | null)[]; color: string; suggestedMax: number;
}) {
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      { label: 'Required pace', data: pace, borderColor: C.ink3, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, tension: 0.25 },
      {
        label: 'Achieved', data: cumulative as number[], borderColor: color, borderWidth: 3.5, tension: 0.35, spanGaps: false,
        pointRadius: (ctx) => (ctx.dataIndex === cumulative.filter((v) => v != null).length - 1 ? 6 : 0),
        pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2.5, pointHoverRadius: 7,
        fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 320);
          g.addColorStop(0, color + '45'); g.addColorStop(1, color + '02'); return g;
        },
      },
    ],
  };
  const options: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', align: 'end', labels: { color: C.ink2, usePointStyle: true, pointStyle: 'line', boxWidth: 22, font: { size: 12 } } },
      tooltip: tooltipStyle,
    },
    scales: { ...baseScales(kfmt), y: { ...baseScales(kfmt).y, suggestedMax } },
  };
  return <Line data={data} options={options} />;
}

/** Hour-by-hour efficiency bars with a target line. */
export function EfficiencyBars({ labels, efficiency, targetEff }: { labels: string[]; efficiency: (number | null)[]; targetEff: number; }) {
  const colors = efficiency.map((v) => (v == null ? 'transparent' : v >= 70 ? C.good : v >= 58 ? C.warn : C.crit));
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ data: efficiency as number[], ...BAR, backgroundColor: barGrad(colors), hoverBackgroundColor: barGrad(colors, 'ff') }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${Number(c.parsed.y).toFixed(1)}% efficiency` } } },
    scales: { ...baseScales((v) => v + '%'), y: { ...baseScales().y, suggestedMax: 100, ticks: { color: C.ink3, font, padding: 8, stepSize: 25, callback: (v: number | string) => v + '%' } } },
  };
  return <Bar data={data} options={options} plugins={[targetLinePlugin(targetEff)]} />;
}

/** Achieved vs Day Target, grouped by factory. */
export function FactoryTargetBars({ labels, target, achieved, colors }: { labels: string[]; target: number[]; achieved: number[]; colors: string[]; }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      { label: 'Day Target', data: target, ...BAR, backgroundColor: (ctx) => vGradient(ctx.chart, '#c7d2e8', 'ff', 'cc'), barPercentage: 0.66, categoryPercentage: 0.7 },
      { label: 'Achieved', data: achieved, ...BAR, backgroundColor: barGrad(colors), hoverBackgroundColor: barGrad(colors, 'ff'), barPercentage: 0.66, categoryPercentage: 0.7 },
    ],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', align: 'end', labels: { color: C.ink2, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, font: { size: 12 } } }, tooltip: tooltipStyle },
    scales: baseScales(kfmt),
  };
  return <Bar data={data} options={options} />;
}

/** Defect breakdown — doughnut by code with center total and legend. */
export function DefectDoughnut({ labels, counts, maxSlices = 9 }: { labels: string[]; counts: number[]; maxSlices?: number; }) {
  const total = counts.reduce((s, c) => s + c, 0);
  let L = labels, Co = counts;
  if (labels.length > maxSlices) {
    const other = counts.slice(maxSlices).reduce((s, c) => s + c, 0);
    L = [...labels.slice(0, maxSlices), 'Other'];
    Co = [...counts.slice(0, maxSlices), other];
  }
  const colors = L.map((lab, i) => (lab === 'Other' ? '#cbd5e1' : palette[i % palette.length]));
  const data: ChartData<'doughnut'> = {
    labels: L,
    datasets: [{ data: Co, backgroundColor: colors, borderColor: '#fff', borderWidth: 2.5, borderRadius: 6, hoverOffset: 10, spacing: 2 }],
  };
  const options: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '64%', layout: { padding: 6 },
    plugins: {
      legend: { position: 'right', labels: { color: C.ink2, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 9, font: { size: 11.5 } } },
      tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${total ? ((Number(c.parsed) / total) * 100).toFixed(1) : 0}%)` } },
    },
  };
  return <Doughnut data={data} options={options} plugins={[doughnutCenter(total)]} />;
}

/** Defect Pareto — counts by code (single sequential series). */
export function DefectParetoBars({ labels, counts }: { labels: string[]; counts: number[]; }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ data: counts, ...BAR, backgroundColor: (ctx) => vGradient(ctx.chart, C.brand), barPercentage: 0.72, categoryPercentage: 0.8 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${c.parsed.y} defects` } } },
    scales: baseScales(),
  };
  return <Bar data={data} options={options} />;
}

/** Average efficiency by factory with target line. */
export function FactoryEffBars({ labels, eff, colors, targetEff }: { labels: string[]; eff: number[]; colors: string[]; targetEff: number; }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ data: eff, ...BAR, backgroundColor: barGrad(colors), hoverBackgroundColor: barGrad(colors, 'ff'), barPercentage: 0.58 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${Number(c.parsed.y).toFixed(1)}% avg efficiency` } } },
    scales: { ...baseScales((v) => v + '%'), y: { ...baseScales().y, suggestedMax: 100, ticks: { color: C.ink3, font, padding: 8, stepSize: 25, callback: (v: number | string) => v + '%' } } },
  };
  return <Bar data={data} options={options} plugins={[targetLinePlugin(targetEff)]} />;
}
