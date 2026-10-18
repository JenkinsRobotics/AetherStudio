import { DashboardCard } from "./DashboardCards";
import { SegmentedControl } from "./SegmentedControl";
import { SelectField } from "./SelectField";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface MappingField { id: string; label: string; required?: boolean; }
export interface FieldMappingFormProps { mode: string; onModeChange: (value: string) => void; fileName: string; itemCount: string; onUpdateFile: () => void; fields: readonly MappingField[]; columns: readonly string[]; value: Readonly<Record<string, string>>; onChange: (value: Record<string, string>) => void; onContinue: () => void; }
export function FieldMappingForm({ mode, onModeChange, fileName, itemCount, onUpdateFile, fields, columns, value, onChange, onContinue }: FieldMappingFormProps) {
  const valid = fields.every(field => !field.required || columns.includes(value[field.id]));
  return <DashboardCard contentOnly density="compact" title="Map fields" className="aui-workflow"><div className="aui-workflow-stack">
    <SegmentedControl ariaLabel="Import mode" value={mode} onChange={onModeChange} options={[{ id: "individual", label: "Individual" }, { id: "list", label: "Lead list" }]} />
    <div className="aui-workflow-file"><span><strong>{fileName}</strong><small>{itemCount}</small></span><Button onClick={onUpdateFile}>Update</Button></div>
    <div className="aui-workflow-map"><span className="aui-workflow-hint">Property</span><span className="aui-workflow-hint">Column in your file</span>{fields.map(field => <label key={field.id} className="aui-workflow-map-row"><span>{field.label}{field.required ? " *" : ""}</span><SelectField aria-label={`Map ${field.label}`} value={value[field.id] ?? ""} onChange={e => onChange({ ...value, [field.id]: e.target.value })} options={[{ value: "", label: "Select column" }, ...columns.map(column => ({ value: column, label: column }))]} /></label>)}</div>
    <Button primary disabled={!valid} onClick={onContinue}>Continue</Button>
  </div></DashboardCard>;
}
