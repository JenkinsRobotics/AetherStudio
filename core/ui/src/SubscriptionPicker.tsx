import { useId } from "react";
import { DashboardCard } from "./DashboardCards";
import { SegmentedControl } from "./SegmentedControl";
import { ChoiceCard } from "./ChoiceCard";
import { SelectField } from "./SelectField";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface SubscriptionPlan { id: string; label: string; description: string; price: string; detail: string; }
export interface SubscriptionPickerProps { plans: readonly SubscriptionPlan[]; selected: string; onSelect: (id: string) => void; period: string; onPeriodChange: (id: string) => void; allowance: string; allowances: readonly { value: string; label: string }[]; onAllowanceChange: (value: string) => void; onSubscribe: () => void; }
export function SubscriptionPicker({ plans, selected, onSelect, period, onPeriodChange, allowance, allowances, onAllowanceChange, onSubscribe }: SubscriptionPickerProps) {
  const name = useId();
  return <DashboardCard contentOnly density="compact" title="Subscription" className="aui-workflow"><div className="aui-workflow-stack">
    <SegmentedControl ariaLabel="Billing period" value={period} onChange={onPeriodChange} options={[{ id: "yearly", label: "Bill yearly" }, { id: "monthly", label: "Bill monthly" }]} />
    <div role="group" aria-label="Plans" className="aui-workflow-stack">{plans.map(plan => <ChoiceCard key={plan.id} name={name} value={plan.id} label={plan.label} description={plan.description} checked={selected === plan.id} onChange={onSelect} detail={<>{plan.price}<small>{plan.detail}</small></>}>
      <div className="aui-workflow-actions"><SelectField aria-label="Credit allowance" value={allowance} onChange={e => onAllowanceChange(e.target.value)} options={allowances} /><Button primary onClick={onSubscribe}>Subscribe</Button></div>
    </ChoiceCard>)}</div>
    <details className="aui-workflow-details"><summary>Compare features</summary><ul>{plans.map(plan => <li key={plan.id}><strong>{plan.label}</strong> — {plan.description} · {plan.detail}</li>)}</ul></details>
  </div></DashboardCard>;
}
