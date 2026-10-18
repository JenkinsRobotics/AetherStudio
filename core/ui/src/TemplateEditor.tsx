import { DashboardCard } from "./DashboardCards";
import { TextField } from "./TextField";
import { StructureStep } from "./StructureStep";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface TemplateStep { id: string; title: string; description: string; }
export interface TemplateEditorProps { stage: "import" | "structure"; name: string; example: string; steps: readonly TemplateStep[]; onNameChange: (value: string) => void; onExampleChange: (value: string) => void; onImport: () => void; onSave: () => void; onCancel: () => void; }
export function TemplateEditor({ stage, name, example, steps, onNameChange, onExampleChange, onImport, onSave, onCancel }: TemplateEditorProps) {
  return <DashboardCard contentOnly density="compact" title={stage === "import" ? "Import framework" : "Confirm structure"} className="aui-workflow"><form className="aui-workflow-stack" onSubmit={e => { e.preventDefault(); if (stage === "import") onImport(); else onSave(); }}>
    <label className="aui-workflow-field">Framework name<TextField required value={name} onChange={e => onNameChange(e.target.value)} /></label>
    {stage === "import" ? <label className="aui-workflow-field">Example message<textarea required value={example} onChange={e => onExampleChange(e.target.value)} placeholder="Enter a sample message to extract its structure" /></label> : <ol className="aui-workflow-steps">{steps.map((step, index) => <li key={step.id}><StructureStep {...step} position={index + 1} /></li>)}</ol>}
    <div className="aui-workflow-actions"><Button type="submit" primary disabled={stage === "structure" && !steps.length}>{stage === "import" ? "Import structure" : "Save framework"}</Button><Button appearance="flat" onClick={onCancel}>Cancel</Button></div>
  </form></DashboardCard>;
}
