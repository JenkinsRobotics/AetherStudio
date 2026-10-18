import { useId, type ReactNode } from "react";
import "./DashboardCards.css";

/** Reusable dashboard surfaces. Values, formatting and business semantics stay with the caller. */
export function DashboardCard({ title, caption, action, children, className = "", density = "standard", contentOnly = false }: { title: string; caption?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; density?: "standard" | "compact"; /** Widget content inherits its host frame. */ contentOnly?: boolean }) {
  const heading = useId();
  return <section className={`aui-dashboard-card ${className}`} data-density={density} data-content-only={contentOnly || undefined} aria-labelledby={heading}>
    <header><div><h2 id={heading}>{title}</h2>{caption && <div className="aui-dashboard-card__caption">{caption}</div>}</div>{action}</header><div className="aui-dashboard-card__body">{children}</div>
  </section>;
}
export function MetricCard({ label, value, icon, change, trend = "neutral", detail }: { label: string; value: string; icon?: ReactNode; change: string; trend?: "positive" | "negative" | "neutral"; detail?: string }) {
  return <article className="aui-metric-card" aria-label={`${label}: ${value}`}>
    <div className="aui-metric-card__label"><span>{icon}</span>{label}</div><strong>{value}</strong>
    <footer><span className="aui-metric-change" data-trend={trend}><b aria-hidden>{trend === "negative" ? "↓" : "↑"}</b>{change}</span><span>{detail}</span></footer>
  </article>;
}
export function GoalProgress({ label, value, target, format = String }: { label: string; value: number; target: number; format?: (n: number) => string }) {
  const ratio = target > 0 && Number.isFinite(value) ? Math.max(0, Math.min(100, value / target * 100)) : 0;
  return <article className="aui-goal-progress"><header><span>{label}</span><strong>{Math.round(ratio)}%</strong></header>
    <progress aria-label={label} max={100} value={ratio}/><footer><strong>{format(value)}</strong><span>of {format(target)}</span></footer>
  </article>;
}
export interface DashboardActivity { id: string; text: string; time: string; tone: "positive" | "negative" | "warning" | "accent"; }
export function ActivityList({ items, onSelect }: { items: readonly DashboardActivity[]; onSelect?: (id: string) => void }) {
  return <ul className="aui-activity-list">{items.length ? items.map(item => <li key={item.id}>
    <button type="button" disabled={!onSelect} onClick={() => onSelect?.(item.id)}><span className="aui-activity-dot" data-tone={item.tone}/><span>{item.text}</span><time>{item.time}</time></button>
  </li>) : <li className="aui-dashboard-empty">No activity to show.</li>}</ul>;
}

import { DataTable, type DataTableProps } from "./DataTable";
/** Spacious, row-divided table presentation for dashboard cards; uses shared sorting/selection. */
export function DashboardTable<Row>({ density = "standard", ...props }: DataTableProps<Row> & { density?: "standard" | "compact" }) {
  return <div className="aui-dashboard-table" data-density={density}><DataTable {...props}/></div>;
}
