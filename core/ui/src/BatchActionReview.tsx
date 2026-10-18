import { DashboardCard } from "./DashboardCards";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface BatchActionReviewProps { title: string; description: string; totalLabel: string; fields: readonly { label: string; value: string }[]; onRun: () => void; onCancel?: () => void; busy?: boolean; }
export function BatchActionReview({ title, description, totalLabel, fields, onRun, onCancel, busy }: BatchActionReviewProps) {
  return <DashboardCard contentOnly density="compact" title={title} className="aui-workflow"><div className="aui-workflow-stack"><p>{description}</p><p className="aui-workflow-hint">{totalLabel}</p>
    <dl className="aui-workflow-summary">{fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <div className="aui-workflow-actions">{onCancel && <Button onClick={onCancel}>Cancel</Button>}<Button primary onClick={onRun} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button></div>
  </div></DashboardCard>;
}
