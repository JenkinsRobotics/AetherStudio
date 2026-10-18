import { DashboardCard } from "./DashboardCards";
import { SelectField } from "./SelectField";
import { Slider } from "./Slider";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface TextVariantsProps { tone: string; onToneChange: (value: string) => void; length: number; onLengthChange: (value: number) => void; variants: readonly { id: string; text: string }[]; selected: string; onSelect: (id: string) => void; onMore: () => void; }
export function TextVariants({ tone, onToneChange, length, onLengthChange, variants, selected, onSelect, onMore }: TextVariantsProps) {
  return <DashboardCard contentOnly density="compact" title="Message variants" className="aui-workflow"><div className="aui-workflow-stack"><div className="aui-workflow-actions"><SelectField aria-label="Tone" value={tone} onChange={e => onToneChange(e.target.value)} options={[{ value: "direct", label: "Direct" }, { value: "friendly", label: "Friendly" }, { value: "formal", label: "Formal" }]} /><Slider ariaLabel="Message length" value={length} onChange={onLengthChange} min={1} max={3} showValue={false} /></div>
    <ul className="aui-workflow-variants">{variants.map(variant => <li key={variant.id}><button type="button" aria-pressed={selected === variant.id} onClick={() => onSelect(variant.id)}>{variant.text}</button></li>)}</ul>
    <Button appearance="link" onClick={onMore}>More variants</Button>
  </div></DashboardCard>;
}
