import { useId, useState } from "react";
import "./DashboardCharts.css";
export interface DashboardChartPoint { id: string; label: string; value: number; }
interface ChartProps { label: string; data: readonly DashboardChartPoint[]; formatValue?: (n: number) => string; selectedID?: string; onSelect?: (id: string) => void; }
const number = (n: number) => n.toLocaleString();
const short = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
/** Smooth cardinal curve through data points; extrema are clamped to avoid overshooting plotted values. */
function curve(points: number[][]) {
  return points.map(([x, y], i) => {
    if (!i) return `M${x},${y}`;
    const p0 = points[Math.max(0, i - 2)], p1 = points[i - 1], p3 = points[Math.min(points.length - 1, i + 1)];
    const clamp = (v: number) => Math.max(Math.min(p1[1], y), Math.min(Math.max(p1[1], y), v));
    return `C${p1[0] + (x - p0[0]) / 6},${clamp(p1[1] + (y - p0[1]) / 6)} ${x - (p3[0] - p1[0]) / 6},${clamp(y - (p3[1] - p1[1]) / 6)} ${x},${y}`;
  }).join(" ");
}
export function DashboardLineChart({ label, data, formatValue = number, selectedID, onSelect, maximum, axisFormat = short }: ChartProps & { maximum?: number; axisFormat?: (n: number) => string }) {
  const gradient = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<string | null>(null);
  if (!data.length) return <div className="aui-dashboard-empty">No chart data.</div>;
  const max = Math.max(1, maximum ?? Math.max(...data.map(p => p.value)) * 1.15);
  const points = data.map((p, i) => [52 + i / Math.max(1, data.length - 1) * 308, 268 - Math.max(0, p.value) / max * 250]);
  const active = Math.max(0, data.findIndex(p => p.id === (hovered ?? selectedID)));
  const [x, y] = points[active], tooltipX = Math.min(250, Math.max(56, x + 16)), tooltipY = Math.min(205, Math.max(10, y - 10));
  const path = curve(points);
  return <svg className="aui-dashboard-line-chart" viewBox="0 0 380 310" role="group" aria-label={label}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".17"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    {[0, 1, 2, 3, 4].map(i => <text key={i} className="aui-dashboard-chart__axis" x="2" y={273 - i * 62.5}>{axisFormat(max * i / 4)}</text>)}
    <path className="aui-dashboard-chart__axis-line" d="M50,18 V277 H364"/>
    <path d={`${path} L360,268 L52,268 Z`} fill={`url(#${gradient})`}/><path d={path} fill="none" stroke="currentColor" strokeWidth="3"/>
    <line x1={x} x2={x} y1="18" y2="276" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 4"/>
    {data.map((point, i) => <g key={point.id}>
      {(i % 2 === 0 || data.length < 7) && <text className="aui-dashboard-chart__axis" x={points[i][0]} y="304" textAnchor="middle">{point.label}</text>}
      <circle className="aui-dashboard-chart__point" cx={points[i][0]} cy={points[i][1]} r={i === active ? 8 : 12} data-active={i === active} tabIndex={0} role="button" aria-label={`${point.label}: ${formatValue(point.value)}`} aria-pressed={selectedID === point.id}
        onMouseEnter={() => setHovered(point.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(point.id)} onBlur={() => setHovered(null)} onClick={() => onSelect?.(point.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(point.id); } }}/>
    </g>)}
    <g className="aui-dashboard-chart__tooltip" transform={`translate(${tooltipX} ${tooltipY})`} aria-hidden="true"><rect width="104" height="65" rx="10"/><text x="12" y="24">{data[active].label}</text><text className="aui-dashboard-chart__value" x="12" y="49">{formatValue(data[active].value)}</text></g>
  </svg>;
}
export function DashboardBarChart({ label, data, formatValue = number, selectedID, onSelect, axisFormat = short }: ChartProps & { axisFormat?: (n: number) => string }) {
  const peak = Math.max(1, ...data.map(point => point.value));
  const step = 10 ** Math.floor(Math.log10(peak / 4));
  const maximum = Math.ceil(peak / (step * 4)) * step * 4;
  return <div className="aui-dashboard-bar-chart" role="group" aria-label={label}>
    <div className="aui-dashboard-bar-chart__axis" aria-hidden>{[1, .75, .5, .25, 0].map(n => <span key={n}>{axisFormat(maximum * n)}</span>)}</div>
    <div className="aui-dashboard-bar-chart__bars">{data.map(point => <button type="button" key={point.id} aria-label={`${point.label}: ${formatValue(point.value)}`} aria-pressed={selectedID === point.id} onClick={() => onSelect?.(point.id)}>
      <span className="aui-dashboard-bar-chart__column" style={{ height: `${Math.max(2, point.value / maximum * 100)}%` }}><span>{formatValue(point.value)}</span></span><span className="aui-dashboard-bar-chart__label">{point.label}</span>
    </button>)}</div>
  </div>;
}
