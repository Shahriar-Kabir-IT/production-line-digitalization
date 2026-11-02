import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, BarController, LineController, Filler, Tooltip, Legend);

export const C = {
  ink: '#131d2e',
  ink2: '#4e5d77',
  ink3: '#8794ab',
  grid: '#eaeef6',
  good: '#0f8a5b',
  warn: '#a96a06',
  crit: '#cc3a3a',
  brand: '#2b57d6',
};
export const facColor: Record<string, string> = { AGL: '#2563eb', ASL: '#7c3aed', AJL: '#0e9488', ABM: '#db2777' };

export const font = { family: "'IBM Plex Mono'", size: 11 };

export const tooltipStyle = {
  backgroundColor: '#131d2e',
  titleColor: '#fff',
  bodyColor: '#d7deeb',
  padding: 10,
  cornerRadius: 8,
  usePointStyle: true,
  boxWidth: 9,
  boxHeight: 9,
};

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
