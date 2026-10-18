import { useId } from "react";
import "./GaugeChart.css";

/** A bounded proportion; the displayed metric and target description stay caller-owned. */
export function GaugeChart({ label, value, detail, fraction }: { label: string; value: string; detail?: string; fraction: number }) {
  const id = useId().replace(/:/g, "");
  const ratio = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const length = Math.PI * 88;
  return <div className="aui-gauge-chart" role="meter" aria-label={`${label}: ${value}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-valuetext={`${value}${detail ? `, ${detail}` : ""}`}>
    <svg viewBox="0 0 224 136" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="72%" stopColor="white"/><stop offset="100%" stopColor="black"/></linearGradient><mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="224" height="136"><rect width="224" height="116" fill={`url(#${id})`}/></mask></defs>
      <g mask={`url(#${id}-mask)`} fill="none" strokeWidth="44">
        <path d="M24 112 A88 88 0 0 1 200 112" stroke="var(--aether-color-warn)"/>
        <path d="M24 112 A88 88 0 0 1 200 112" stroke="var(--aether-color-accent)" strokeDasharray={`${length * ratio} ${length}`}/>
        {ratio > 0 && ratio < 1 && <path d="M24 112 A88 88 0 0 1 200 112" stroke="var(--aether-color-bg-panel)" strokeDasharray={`0 ${Math.max(0, length * ratio - 1.5)} 3 ${length}`}/>}
      </g>
      <text className="aui-gauge-value" x="112" y="94" textAnchor="middle">{value}</text>
      {detail && <text className="aui-gauge-detail" x="112" y="115" textAnchor="middle">{detail}</text>}
    </svg>
  </div>;
}
