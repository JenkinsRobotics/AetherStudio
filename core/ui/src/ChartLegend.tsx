import type { CSSProperties } from "react";
import "./AnalyticsElements.css";

export interface ChartSeries { id: string; label: string; color: string; }
/** Shared labelled swatches, optionally toggling the visibility of each series. */
export function ChartLegend({ series, hidden = [], onToggle, label = "Chart series" }: { series: readonly ChartSeries[]; hidden?: readonly string[]; onToggle?: (id: string) => void; label?: string }) {
  return <div className="aui-chart-legend" role="group" aria-label={label}>{series.map(item => {
    const contents = <><span className="aui-chart-swatch" style={{ "--series-color": item.color } as CSSProperties}/>{item.label}</>;
    return onToggle ? <button key={item.id} type="button" aria-pressed={!hidden.includes(item.id)} onClick={() => onToggle(item.id)}>{contents}</button> : <span key={item.id}>{contents}</span>;
  })}</div>;
}
