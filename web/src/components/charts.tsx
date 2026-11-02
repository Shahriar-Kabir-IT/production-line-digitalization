import { Line, Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { C, font, tooltipStyle, targetLinePlugin } from './chartSetup';

const baseScales = (yCallback?: (v: number) => string) => ({
  x: { grid: { display: false }, ticks: { color: C.ink3, font } },
  y: {
    beginAtZero: true,
    grid: { color: C.grid },
    border: { display: false },
    ticks: { color: C.ink3, font, callback: (v: number | string) => (yCallback ? yCallback(Number(v)) : v) },
  },
});

const kfmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v));

/** Target Against Achieved — cumulative achieved vs required pace. */
export function TargetAchievedChart({ labels, pace, cumulative, color, suggestedMax }: {
  labels: string[]; pace: number[]; cumulative: (number | null)[]; color: string; suggestedMax: number;
}) {
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      { label: 'Required pace', data: pace, borderColor: C.ink3, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, tension: 0.25 },
      {
        label: 'Achieved', data: cumulative as number[], borderColor: color, borderWidth: 3, tension: 0.3, spanGaps: false,
        pointRadius: (ctx) => (ctx.dataIndex === cumulative.filter((v) => v != null).length - 1 ? 5 : 0),
        pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2,
        fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
          g.addColorStop(0, color + '38'); g.addColorStop(1, color + '03'); return g;
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
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{
      data: efficiency as number[], borderRadius: 4, borderSkipped: false,
      backgroundColor: efficiency.map((v) => (v == null ? 'transparent' : v >= 70 ? C.good : v >= 58 ? C.warn : C.crit)),
    }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${Number(c.parsed.y).toFixed(1)}% efficiency` } } },
    scales: { ...baseScales((v) => v + '%'), y: { ...baseScales().y, suggestedMax: 100, ticks: { color: C.ink3, font, stepSize: 25, callback: (v: number | string) => v + '%' } } },
  };
  return <Bar data={data} options={options} plugins={[targetLinePlugin(targetEff)]} />;
}

/** Achieved vs Day Target, grouped by factory. */
export function FactoryTargetBars({ labels, target, achieved, colors }: { labels: string[]; target: number[]; achieved: number[]; colors: string[]; }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      { label: 'Day Target', data: target, backgroundColor: '#dbe2ef', borderRadius: 4, borderSkipped: false, barPercentage: 0.64, categoryPercentage: 0.7 },
      { label: 'Achieved', data: achieved, backgroundColor: colors, borderRadius: 4, borderSkipped: false, barPercentage: 0.64, categoryPercentage: 0.7 },
    ],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', align: 'end', labels: { color: C.ink2, usePointStyle: true, boxWidth: 9, font: { size: 12 } } }, tooltip: tooltipStyle },
    scales: baseScales(kfmt),
  };
  return <Bar data={data} options={options} />;
}

/** Defect Pareto — counts by code (single sequential series). */
export function DefectParetoBars({ labels, counts }: { labels: string[]; counts: number[]; }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ data: counts, backgroundColor: C.brand, borderRadius: 4, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.8 }],
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
    datasets: [{ data: eff, backgroundColor: colors, borderRadius: 4, borderSkipped: false, barPercentage: 0.55 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => ` ${Number(c.parsed.y).toFixed(1)}% avg efficiency` } } },
    scales: { ...baseScales((v) => v + '%'), y: { ...baseScales().y, suggestedMax: 100, ticks: { color: C.ink3, font, stepSize: 25, callback: (v: number | string) => v + '%' } } },
  };
  return <Bar data={data} options={options} plugins={[targetLinePlugin(targetEff)]} />;
}
