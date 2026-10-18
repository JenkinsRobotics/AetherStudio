import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import "./RelationEditor.css";

/** Display values only. The owning product converts units and validates/evaluates coupling. */
export interface RelationEditorValue {
  kind: string; driver: string; driven: string; magnitude: number; reversed: boolean; offset: number;
}
export interface RelationEditorOption { value: string; label: string; }
export interface RelationEditorProps {
  value: RelationEditorValue; onChange: (value: RelationEditorValue) => void;
  kinds: readonly RelationEditorOption[]; drivers: readonly RelationEditorOption[]; driven: readonly RelationEditorOption[];
  ratioLabel: string; ratioUnit?: string; offsetUnit: string; compatibility?: string;
  busy?: boolean; editing?: boolean; error?: string; description?: string; valid?: boolean;
  onApply: () => void; onCancel: () => void; onRemove?: () => void;
}
export function RelationEditor(props: RelationEditorProps) {
  const {value,onChange,busy=false}=props;
  const change=(patch:Partial<RelationEditorValue>)=>onChange({...value,...patch});
  const numbersValid=Number.isFinite(value.magnitude) && value.magnitude>0 && Number.isFinite(value.offset);
  return <form className="aui-relation-editor" aria-label="Advanced relation" onSubmit={event=>{event.preventDefault();if(!busy && numbersValid && value.driver && value.driven && value.driver!==value.driven && props.valid!==false)props.onApply();}}>
    <fieldset disabled={busy}><legend>RELATION TYPE</legend>
      <label>Type<SelectField aria-label="Relation type" disabled={props.editing} value={value.kind} onChange={event=>change({kind:event.target.value,driver:"",driven:""})} options={props.kinds}/></label>
      {props.compatibility && <p>{props.compatibility}</p>}
    </fieldset>
    <fieldset disabled={busy}><legend>COUPLED MATE DOFS</legend>
      <label>Driver<SelectField aria-label="Relation driver" value={value.driver} onChange={event=>change({driver:event.target.value})} options={[{value:"",label:"Choose driver…"},...props.drivers]}/></label>
      <label>Driven<SelectField aria-label="Relation driven" disabled={props.editing} value={value.driven} onChange={event=>change({driven:event.target.value})} options={[{value:"",label:"Choose driven…"},...props.driven]}/></label>
    </fieldset>
    <fieldset disabled={busy}><legend>RELATIONSHIP</legend>
      <label>{props.ratioLabel}<NumberField aria-label={props.ratioLabel} value={Number.isFinite(value.magnitude)?value.magnitude:null} min={.000001} step={.1} unit={props.ratioUnit} onValueChange={number=>change({magnitude:number??NaN})}/></label>
      <Checkbox label="Reverse direction" checked={value.reversed} onChange={event=>change({reversed:event.target.checked})}/>
      <label>Driven offset<NumberField aria-label="Driven offset" value={Number.isFinite(value.offset)?value.offset:null} unit={props.offsetUnit} onValueChange={number=>change({offset:number??NaN})}/></label>
    </fieldset>
    {props.description && <p>{props.description}</p>}
    {props.error && <p role="alert">{props.error}</p>}
    <footer><Button disabled={busy} onClick={props.onCancel}>Cancel</Button>{props.onRemove && <Button disabled={busy} onClick={props.onRemove}>Remove relation</Button>}<Button type="submit" primary disabled={busy || !numbersValid || !value.driver || !value.driven || value.driver===value.driven || props.valid===false}>{busy?"Applying…":props.editing?"Apply relation":"Create relation"}</Button></footer>
  </form>;
}
