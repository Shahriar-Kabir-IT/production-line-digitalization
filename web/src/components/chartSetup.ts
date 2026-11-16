import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  DoughnutController,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  BarController, LineController, DoughnutController, Filler, Tooltip, Legend,
);

// Softer global defaults for a more polished feel.
Chart.defaults.font.family = "'IBM Plex Mono'";
// Animations OFF: Chart.js crashes ("this._fn is not a function") trying to animate
// the scriptable CanvasGradient fills, which blanks the whole chart. Rendering the
// final frame directly keeps the gradients and is instant.
Chart.defaults.animation = false as unknown as typeof Chart.defaults.animation;
(Chart.defaults as unknown as { animations: unknown }).animations = {};
(Chart.defaults as unknown as { transitions: { active: { animation: { duration: number } } } }).transitions = { active: { animation: { duration: 0 } } };

export const C = {
  ink: '#131d2e',
  ink2: '#4e5d77',
  ink3: '#8794ab',
  grid: '#eef2f8',
  good: '#0f8a5b',
  warn: '#d1890a',
  crit: '#e0443e',
  brand: '#2b57d6',
};
export const facColor: Record<string, string> = { AGL: '#2563eb', ASL: '#7c3aed', AJL: '#0e9488', ABM: '#db2777' };

// Harmonious categorical palette for the defect doughnut (up to 12 slices).
export const palette = [
  '#2b57d6', '#7c3aed', '#0e9488', '#db2777', '#f59e0b', '#0ea5e9',
  '#16a34a', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
];

export const font = { family: "'IBM Plex Mono'", size: 11 };

export const tooltipStyle = {
  backgroundColor: 'rgba(16,24,40,.94)',
  titleColor: '#fff',
  bodyColor: '#e6ebf5',
  padding: 11,
  cornerRadius: 10,
  borderColor: 'rgba(255,255,255,.08)',
  borderWidth: 1,
  usePointStyle: true,
  boxWidth: 9,
  boxHeight: 9,
  titleFont: { family: "'IBM Plex Mono'", size: 11.5, weight: 'bold' as const },
  bodyFont: { family: "'IBM Plex Mono'", size: 12 },
};

/** A vertical top→bottom gradient from a solid color, for bars/areas. */
export function vGradient(chart: Chart, color: string, alphaTop = 'ff', alphaBottom = 'b0'): CanvasGradient | string {
  const area = chart.chartArea;
  if (!area) return color;
  // Only #rrggbb colors take an appended hex alpha; anything else (e.g. 'transparent'
  // for an empty hour) is used as-is — appending to it makes an invalid color that
  // throws in addColorStop and blanks the whole chart.
  const isHex = /^#[0-9a-fA-F]{6}$/.test(color);
  const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, isHex ? color + alphaTop : color);
  g.addColorStop(1, isHex ? color + alphaBottom : color);
  return g;
}

/** Horizontal target line plugin for bar charts. */
export function targetLinePlugin(yValue: number, label = 'Target') {
  return {
    id: 'targetline-' + Math.random().toString(36).slice(2),
    afterDatasetsDraw(chart: Chart) {
      const y = chart.scales.y.getPixelForValue(yValue);
      const { left, right } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = C.brand;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.brand;
      ctx.font = "600 10px 'IBM Plex Mono'";
      ctx.textAlign = 'right';
      ctx.fillText(`${label} ${yValue}%`, right - 4, y - 5);
      ctx.restore();
    },
  };
}

/** Draw each bar's value on top of the bar. */
export function barValueLabels(fmt: (v: number) => string) {
  return {
    id: 'barvals-' + Math.random().toString(36).slice(2),
    afterDatasetsDraw(chart: Chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "700 10px 'IBM Plex Mono'";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = C.ink;
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((el, i) => {
          const v = ds.data[i] as number | null;
          if (v == null || v <= 0) return;
          ctx.fillText(fmt(Number(v)), (el as unknown as { x: number }).x, (el as unknown as { y: number }).y - 4);
        });
      });
      ctx.restore();
    },
  };
}

/** Leader-line callout labels around a doughnut: "Name" + "N Pieces (X.XX%)". */
export function doughnutCallouts() {
  return {
    id: 'callouts-' + Math.random().toString(36).slice(2),
    afterDraw(chart: Chart) {
      const meta = chart.getDatasetMeta(0);
      const arcs = meta.data as unknown as { x: number; y: number; startAngle: number; endAngle: number; outerRadius: number }[];
      if (!arcs.length) return;
      const ds = chart.data.datasets[0];
      const labels = chart.data.labels as string[];
      const colors = ds.backgroundColor as string[];
      const vals = ds.data as number[];
      const total = vals.reduce((s, v) => s + (v || 0), 0) || 1;
      const ctx = chart.ctx;
      const cx = arcs[0].x, cy = arcs[0].y, r = arcs[0].outerRadius;
      const { top, bottom } = chart.chartArea;

      type Item = { i: number; cos: number; sin: number; ax: number; ay: number; side: number; y: number };
      const items: Item[] = arcs.map((a, i) => {
        const mid = (a.startAngle + a.endAngle) / 2;
        const cos = Math.cos(mid), sin = Math.sin(mid);
        return { i, cos, sin, ax: cx + cos * r, ay: cy + sin * r, side: cos >= 0 ? 1 : -1, y: cy + sin * (r + 22) };
      });

      const lineH = 34;
      const half = 15; // each label is two text lines (name + pieces), ~15px above/below its y
      [1, -1].forEach((side) => {
        const list = items.filter((it) => it.side === side).sort((a, b) => a.y - b.y);
        // push apart so labels don't overlap, then clamp fully inside the plot area
        for (let k = 1; k < list.length; k++) if (list[k].y - list[k - 1].y < lineH) list[k].y = list[k - 1].y + lineH;
        const overflow = list.length ? list[list.length - 1].y - (bottom - half) : 0;
        if (overflow > 0) list.forEach((it) => (it.y -= overflow));
        const topOver = list.length ? (top + half) - list[0].y : 0;
        if (topOver > 0) list.forEach((it) => (it.y += topOver));

        list.forEach((it) => {
          const elbowX = cx + it.cos * (r + 12);
          const elbowY = cy + it.sin * (r + 12);
          const labelX = cx + side * (r + 56);
          ctx.strokeStyle = colors[it.i]; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(it.ax, it.ay); ctx.lineTo(elbowX, elbowY); ctx.lineTo(labelX, it.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(labelX, it.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = colors[it.i]; ctx.fill();
          const tx = labelX + side * 7;
          ctx.textAlign = side === 1 ? 'left' : 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = C.ink; ctx.font = "700 12px 'Barlow Semi Condensed', system-ui, sans-serif";
          ctx.fillText(labels[it.i], tx, it.y - 7);
          ctx.fillStyle = C.ink2; ctx.font = "600 11px 'IBM Plex Mono', monospace";
          ctx.fillText(`${vals[it.i]} Pieces (${((vals[it.i] / total) * 100).toFixed(2)}%)`, tx, it.y + 7);
        });
      });
    },
  };
}

/** Center label for a doughnut (big total + caption). */
export function doughnutCenter(total: number, caption = 'defects') {
  return {
    id: 'doughnut-center-' + Math.random().toString(36).slice(2),
    afterDraw(chart: Chart) {
      const meta = chart.getDatasetMeta(0);
      const arc = meta?.data?.[0] as unknown as { x: number; y: number } | undefined;
      if (!arc) return;
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink;
      ctx.font = "800 26px 'Barlow Semi Condensed', 'IBM Plex Mono'";
      ctx.fillText(total.toLocaleString(), arc.x, arc.y - 6);
      ctx.fillStyle = C.ink3;
      ctx.font = "600 10px 'IBM Plex Mono'";
      ctx.fillText(caption.toUpperCase(), arc.x, arc.y + 14);
      ctx.restore();
    },
  };
}
