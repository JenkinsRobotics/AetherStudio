import { useState } from "react";
import { ChartLegend, type ChartSeries } from "./ChartLegend";
import "./ComparisonChart.css";

export interface ComparisonPoint { id: string; label: string; values: Readonly<Record<string, number>>; }
export interface ComparisonChartProps {
  label: string;
  data: readonly ComparisonPoint[];
  series: readonly ChartSeries[];
  kind?: "line" | "bar";
  selectedID?: string;
  onSelect?: (id: string) => void;
  formatValue?: (value: number) => string;
}
const amount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const compact = (value: number) => value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : String(Math.round(value));

/** Nonnegative multi-series comparisons, with keyboard inspection and legend toggles. */
export function ComparisonChart({ label, data, series, kind = "line", selectedID, onSelect, formatValue = compact }: ComparisonChartProps) {
  const [hidden, setHidden] = useState<string[]>([]), [hovered, setHovered] = useState<string | null>(null);
  const visible = series.filter(item => !hidden.includes(item.id));
  if (!data.length || !series.length) return <p className="aui-dashboard-empty">No chart data.</p>;
  const peak = Math.max(1, ...data.flatMap(point => visible.map(item => amount(point.values[item.id]))));
  const step = 10 ** Math.floor(Math.log10(peak / 4));
  const maximum = Math.ceil(peak / (step * 2)) * step * 2;
  const x = (index: number) => kind === "bar" ? 40 + (index + .5) * 544 / data.length : 40 + index * 544 / Math.max(1, data.length - 1);
  const y = (value: number) => 148 - amount(value) / maximum * 124;
  const active = data.findIndex(point => point.id === (hovered ?? selectedID));
  const uniqueLabels = data.flatMap((point, index) => index === 0 || point.label !== data[index - 1].label ? [index] : []);
  const labelIndices = new Set(uniqueLabels.filter((_, index) => index % Math.max(1, Math.ceil(uniqueLabels.length / 11)) === 0));
  const activePoint = data[active];
  const inspect = (id: string) => { setHovered(id); onSelect?.(id); };
  return <div className="aui-comparison-chart">
    <ChartLegend series={series} hidden={hidden} onToggle={id => setHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])} label={`${label} series`}/>
    {!visible.length ? <p className="aui-dashboard-empty">Select a series to display.</p> : <svg viewBox="0 0 600 178" role="group" aria-label={label}>
      {[0, 1, 2, 3, 4].map(tick => <g key={tick} className="aui-comparison-axis"><line x1="38" x2="586" y1={148 - tick * 31} y2={148 - tick * 31}/><text x="28" y={151 - tick * 31} textAnchor="end">{formatValue(maximum * tick / 4)}</text></g>)}
      {visible.map((item, seriesIndex) => kind === "line" ? <polyline key={item.id} points={data.map((point, i) => `${x(i)},${y(point.values[item.id])}`).join(" ")} fill="none" stroke={item.color} strokeWidth="2"/>
        : <g key={item.id} fill={item.color}>{data.map((point, i) => { const width = Math.min(5, 544 / data.length / (visible.length + 2)); return <rect key={point.id} x={x(i) + (seriesIndex - (visible.length - 1) / 2) * (width + 3) - width / 2} y={y(point.values[item.id])} width={width} height={148 - y(point.values[item.id])} rx="1"/>; })}</g>)}
      {data.map((point, i) => <g key={point.id}>
        {labelIndices.has(i) && <text className="aui-comparison-label" x={x(i)} y="170" textAnchor="middle">{point.label}</text>}
        <rect className="aui-comparison-hit" x={Math.max(32, x(i) - 272 / data.length)} y="20" width={544 / data.length} height="130" role="button" tabIndex={0}
          aria-label={`${point.label}: ${visible.map(item => `${item.label} ${formatValue(amount(point.values[item.id]))}`).join(", ")}`} aria-pressed={point.id === selectedID}
          onMouseEnter={() => setHovered(point.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(point.id)} onBlur={() => setHovered(null)} onClick={() => inspect(point.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(point.id); } }}/>
      </g>)}
      {activePoint && <g className="aui-comparison-inspection" aria-hidden="true">
        <line x1={x(active)} x2={x(active)} y1="24" y2="148"/>
        <g transform={`translate(${Math.min(398, Math.max(40, x(active) - 80))},2)`}><rect width="186" height="18" rx="4"/><text x="8" y="12">{visible.map(item => `${item.label}: ${formatValue(amount(activePoint.values[item.id]))}`).join(" · ")}</text></g>
      </g>}
    </svg>}
  </div>;
}
