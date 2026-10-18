import type { ReactNode } from "react";
import "./WorkflowElements.css";
export interface ChoiceCardProps { name: string; value: string; label: string; description?: string; detail?: ReactNode; checked: boolean; onChange: (value: string) => void; disabled?: boolean; children?: ReactNode; }
/** Native radio semantics; interactive selected content stays outside its label. */
export function ChoiceCard({ name, value, label, description, detail, checked, onChange, disabled, children }: ChoiceCardProps) {
  return <div className="aui-choice-card" data-selected={checked} data-disabled={disabled || undefined}>
    <label><input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>{detail && <span className="aui-choice-card-detail">{detail}</span>}
    </label>{checked && children && <div className="aui-choice-card-content">{children}</div>}
  </div>;
}
